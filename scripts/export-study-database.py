"""Export the stable Verbwerk study database to its offline browser asset."""
import argparse
from collections import Counter, defaultdict
import hashlib
import json
from pathlib import Path
import re
import sqlite3

ARTICLES = {"der", "die", "das"}
REVIEW = "source_candidate"
EXAMPLE_PRIORITY = {"editorial": 0, "course_reviewed": 1, "reference_match": 2, "inherited": 3, REVIEW: 4}
VERSION = "2026-11-11.4"


def sha256(path):
    with path.open("rb") as handle:
        return hashlib.file_digest(handle, "sha256").hexdigest()


def canonical(text):
    return text.strip().casefold()


def valid_articles(value):
    return [item for item in value if item in ARTICLES] if isinstance(value, list) else []


def noun_forms(fields):
    article = fields.get("article")
    plural = fields.get("plural")
    values = plural if isinstance(plural, list) else []
    forms = [value for value in values if re.fullmatch(r"[\wÄÖÜäöüß]+(?:[- ][\wÄÖÜäöüß]+){0,2}", value)
             and not value.lower().startswith(("usually ", "plural ", "no "))]
    notes = [value for value in values if value not in forms]
    if isinstance(plural, str):
        notes.append(plural)
    elif isinstance(plural, dict):
        if isinstance(plural.get("note"), str):
            notes.append(plural["note"])
        usage = fields.get("usage")
        if isinstance(usage, str) and usage:
            notes.append(usage)
    return {"articles": valid_articles(article), "article_note": article if isinstance(article, str) else "",
            "plurals": forms, "number_note": " ".join(notes)}


def example(row):
    return {"german": row["german"], "english": row["english"], "status": row["status"],
            "source": row["source"], "attribution": row["attribution"]}


def candidate_priority(row):
    evidence = row["matching_evidence"] or ""
    try:
        values = json.loads(evidence)
    except ValueError:
        values = {}
    if not isinstance(values, dict):
        values = {}
    return (0 if "Wiktionary" in row["source"] and not values.get("translation") else 1,
            -len(values.get("english_overlap") or values.get("english_stem_overlap") or []),
            0 if values.get("translation") else 1, len(row["german"]))


def fallback_targets(lemma, known, candidates):
    targets = {lemma}
    for key in ("present", "preterite", "participle", "plural"):
        value = known.get(key, candidates.get(key))
        if key == "present" and isinstance(value, dict):
            value = [item for forms in value.values() for item in (forms if isinstance(forms, list) else [forms])]
        if isinstance(value, list):
            targets.update(item for item in value if isinstance(item, str) and re.fullmatch(r"[^\W\d_]+", item))
    return re.compile(r"(?<!\w)(?:" + "|".join(re.escape(value) for value in sorted(targets)) + r")(?!\w)", flags=re.I)


def source_keys(conn):
    routes = {kind: {} for kind in ("general", "frequency", "pilot", "article", "course")}
    links = defaultdict(dict)
    article_by_pair = {}
    for row in conn.execute("SELECT entry_id,source,record_json FROM v11_source_records ORDER BY source_index"):
        key, source, record = row["entry_id"], row["source"], json.loads(row["record_json"])
        if source == "articles":
            article_by_pair[(record["a"], record["n"])] = key
            continue
        kind = {"curated": "general", "frequency": "frequency", "pilot": "pilot", "course": "course"}[source]
        source_id = str(record["rank"] if source == "frequency" else record["id"])
        routes[kind][source_id] = key
        links[key].setdefault(kind, []).append(source_id)
    return routes, links, article_by_pair


def build(db, directory):
    with sqlite3.connect(db.resolve().as_uri() + "?mode=ro", uri=True) as conn:
        conn.row_factory = sqlite3.Row
        if conn.execute("PRAGMA quick_check").fetchone()[0] != "ok":
            raise ValueError("SQLite integrity check failed")
        routes, links, article_by_pair = source_keys(conn)
        fields = defaultdict(dict)
        for row in conn.execute("SELECT * FROM field_checks"):
            fields[row["entry_id"]][row["field"]] = (row["status"], json.loads(row["value_json"] or "null"))
        examples = defaultdict(list)
        for row in conn.execute("SELECT * FROM examples ORDER BY rowid"):
            examples[row["entry_id"]].append(row)
        inflected = {row["entry_id"]: dict(row) for row in conn.execute("SELECT * FROM inflected_entry_reference")}
        entries = []
        for row in conn.execute("SELECT * FROM entries ORDER BY rowid"):
            key = row["entry_id"]
            known, candidates = {}, {}
            for name, (status, value) in fields[key].items():
                if name in {"word_class", "meaning", "example"} or value is None:
                    continue
                if status == REVIEW:
                    candidates[name] = value
                elif status in {"editorial", "course_reviewed", "reference_match", "present"}:
                    known[name] = value
            source_examples = sorted(examples[key], key=lambda x: EXAMPLE_PRIORITY.get(x["status"], 5))
            selected = [example(x) for x in source_examples if x["status"] != REVIEW and x["german"] and x["english"]][:3]
            candidate_rows = [x for x in source_examples if x["status"] == REVIEW and x["german"] and x["english"]]
            candidate = example(min(candidate_rows, key=candidate_priority)) if candidate_rows else None
            fallback = None
            if canonical(row["english_meaning"]) == canonical(row["v11_meaning"]):
                target = fallback_targets(row["lemma"], known, candidates)
                fallback = next((example(x) for x in source_examples if x["status"] == "inherited"
                                 and not x["english"] and target.search(x["german"])), None)
            if not selected and not candidate:
                raise ValueError(f"No bilingual example for {key}")
            record = {"entry_id": key, "lemma": row["lemma"], "word_class": row["word_class"],
                      "english_meaning": row["english_meaning"], "display_form": row["v11_display"],
                      "frequency_rank": row["frequency_rank"], "course_id": row["course_id"],
                      "sources": json.loads(row["sources"]), "links": links[key],
                      "grammar": known, "candidate_grammar": candidates, "examples": selected,
                      "candidate_example": candidate if not selected else None, "fallback_example": fallback if not selected else None}
            if row["word_class"] == "noun":
                record["noun"] = noun_forms(known)
            if key in inflected:
                info = inflected[key]
                record["base_lemma"], record["form_note"] = info["base_lemma"], info["form_note"]
            entries.append(record)

        by_id = {record["entry_id"]: record for record in entries}
        article_bank = []
        for row in conn.execute("SELECT * FROM v11_article_bank ORDER BY position"):
            original = json.loads(row["source_json"])
            key = article_by_pair[(original["a"], original["n"])]
            entry = by_id[key]
            noun = entry.get("noun", {})
            articles = noun.get("articles", [])
            note = noun.get("article_note", "")
            # Preserve existing lesson order. Only an authoritative, fixed article can be scored.
            eligible = bool(row["eligible"] and len(articles) == 1 and not note)
            is_noun = entry["word_class"] == "noun"
            if is_noun:
                routes["article"][row["lemma"].casefold()] = key
            article_bank.append({"position": row["position"], "entry_id": key, "lemma": row["lemma"],
                                 "article": " / ".join(articles), "articles": articles, "browsable": is_noun,
                                 "plural": " / ".join(noun.get("plurals", [])), "number_note": noun.get("number_note", ""),
                                 "candidate_plural": entry["candidate_grammar"].get("plural"),
                                 "english": entry["english_meaning"], "eligible": eligible, "scheduled": bool(row["eligible"]),
                                 "id": original.get("id", ""), "source": original.get("source", ""), "note": note})

        counts = Counter(record["word_class"] for record in entries)
        if len(by_id) != 5396 or len(entries) != 5396 or counts["verb"] != 1190 or counts["noun"] != 2620 or len(routes["frequency"]) != 5000:
            raise ValueError("Unexpected V11 vocabulary identity or counts")
        meta = {"dataset_id": "verbwerk.merged.de", "version": VERSION, "source_database": db.name,
                "source_database_sha256": sha256(db), "entry_count": len(entries), "word_class_counts": dict(sorted(counts.items())),
                "article_bank_count": sum(x["browsable"] for x in article_bank),
                "article_lesson_slot_count": sum(x["scheduled"] for x in article_bank),
                "article_practice_count": sum(x["eligible"] for x in article_bank),
                "trusted_bilingual_example_count": sum(bool(x["examples"]) for x in entries),
                "candidate_bilingual_example_count": sum(bool(x["candidate_example"]) for x in entries),
                "german_only_fallback_count": sum(bool(x["fallback_example"]) for x in entries)}
        provenance = [dict(row) for row in conn.execute("SELECT source,reference,license FROM provenance ORDER BY source")]
    path = directory / "vocabulary-latest-database.js"
    asset = {"metadata": meta, "entries": entries, "routes": routes, "article_bank": article_bank, "provenance": provenance}
    path.write_text("window.VW_LATEST_VOCABULARY = " + json.dumps(asset, ensure_ascii=False, separators=(",", ":")) + ";\n", encoding="utf-8")
    manifest_path = directory / "vocabulary-manifest.json"
    manifest = json.loads(manifest_path.read_text(encoding="utf-8-sig"))
    manifest["latest_database"] = {**meta, "asset": path.name, "asset_sha256": sha256(path)}
    manifest_path.write_text(json.dumps(manifest, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(json.dumps(meta, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("database", type=Path)
    parser.add_argument("app_directory", type=Path)
    args = parser.parse_args()
    build(args.database, args.app_directory)

