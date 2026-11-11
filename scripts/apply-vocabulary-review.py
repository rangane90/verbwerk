"""Apply a reviewed vocabulary batch to a copied SQLite source, never to its input."""
import argparse
import hashlib
import json
from pathlib import Path
import re
import shutil
import sqlite3

def sha256(path):
    digest=hashlib.sha256()
    with path.open("rb") as stream:
        for chunk in iter(lambda: stream.read(1024*1024), b""):
            digest.update(chunk)
    return digest.hexdigest()

def read_assignment(path, variable):
    text=path.read_text(encoding="utf-8-sig")
    start=text.index("window."+variable)
    start=text.index("=", start)+1
    end=text.rfind(";")
    return json.loads(text[start:end].strip())

def meaning_tokens(value):
    return " ".join(re.findall(r"[a-z]+", str(value or "").casefold()))

def parse_json(value):
    try:
        return json.loads(value) if value else None
    except (TypeError, ValueError):
        return value

def field_row(conn, entry_id, field):
    return conn.execute(
        "SELECT status,value_json,source,evidence_json FROM field_checks WHERE entry_id=? AND field=?",
        (entry_id, field)
    ).fetchone()

def write_field(conn, entry_id, field, value, status, source, review, allowed_statuses):
    row=field_row(conn, entry_id, field)
    if not row or row["status"] not in allowed_statuses:
        raise ValueError(f"Unexpected existing field state for {entry_id}:{field}: {row['status'] if row else 'missing'}")
    evidence={"prior_evidence": parse_json(row["evidence_json"]), "review": review}
    conn.execute(
        "UPDATE field_checks SET status=?,value_json=?,source=?,evidence_json=? WHERE entry_id=? AND field=?",
        (status,json.dumps(value,ensure_ascii=False),source,json.dumps(evidence,ensure_ascii=False,sort_keys=True),entry_id,field)
    )

def apply(input_db, output_db, patch_path, gender_path):
    patch=json.loads(patch_path.read_text(encoding="utf-8-sig"))
    if sha256(input_db) != patch["input_database_sha256"]:
        raise ValueError("Input database hash does not match the reviewed batch.")
    if input_db.resolve() == output_db.resolve():
        raise ValueError("Output must be a copy; the source database is read-only.")
    output_db.parent.mkdir(parents=True,exist_ok=True)
    shutil.copy2(input_db,output_db)
    gender=read_assignment(gender_path,"VW_GERMAN_NOUN_GENDERS").get("entries",{})
    review_date=patch["review_date"]
    auto_ids=[]
    with sqlite3.connect(output_db) as conn:
        conn.row_factory=sqlite3.Row
        conn.execute("PRAGMA foreign_keys=ON")
        if conn.execute("PRAGMA integrity_check").fetchone()[0] != "ok":
            raise ValueError("Copied input database failed SQLite integrity check.")
        conn.execute("BEGIN IMMEDIATE")
        article_rows=conn.execute("""
            SELECT e.entry_id,e.lemma,e.english_meaning,f.value_json,f.source,f.evidence_json
            FROM field_checks f JOIN entries e USING(entry_id)
            WHERE f.field='article' AND f.status='source_candidate'
            ORDER BY e.entry_id
        """).fetchall()
        if len(article_rows) != 136:
            raise ValueError(f"Expected 136 candidate article fields, found {len(article_rows)}.")
        for row in article_rows:
            evidence=parse_json(row["evidence_json"]) or {}
            senses=evidence.get("sense",[]) if isinstance(evidence,dict) else []
            if not isinstance(senses,list):
                senses=[senses]
            article_value=parse_json(row["value_json"])
            if not isinstance(article_value,list) or not article_value:
                continue
            indexed=gender.get(row["lemma"].strip().casefold(),{}).get("articles",[])
            if (any(meaning_tokens(sense)==meaning_tokens(row["english_meaning"]) for sense in senses)
                    and set(article_value).issubset(set(indexed))):
                review={
                    "date":review_date,
                    "method":patch["article_exact_sense_rule"]["criterion"],
                    "source_sense":senses,
                    "cross_check":"Existing noun-gender index"
                }
                conn.execute(
                    "UPDATE field_checks SET status='reference_match',evidence_json=? WHERE entry_id=? AND field='article' AND status='source_candidate'",
                    (json.dumps({"prior_evidence":evidence,"review":review},ensure_ascii=False,sort_keys=True),row["entry_id"])
                )
                auto_ids.append(row["entry_id"])
        expected=patch["article_exact_sense_rule"]["expected_count"]
        if len(auto_ids) != expected:
            raise ValueError(f"Expected {expected} exact-sense, cross-checked articles; found {len(auto_ids)}.")
        by_lemma={}
        for row in conn.execute("SELECT entry_id,lemma FROM entries"):
            by_lemma.setdefault(row["lemma"],[]).append(row["entry_id"])
        for lemma,exception in patch["article_exceptions"].items():
            ids=by_lemma.get(lemma,[])
            if len(ids) != 1:
                raise ValueError(f"Expected one entry for article exception {lemma}, found {len(ids)}.")
            entry_id=ids[0]
            source=exception.get("source","Duden")
            url=exception.get("url") or exception.get("article_url")
            review={"date":review_date,"decision":exception["note"]}
            if url:
                review["url"]=url
            if exception.get("plural_url"):
                review["plural_url"]=exception["plural_url"]
            if "article" in exception:
                write_field(conn,entry_id,"article",exception["article"],"editorial",source,review,{"source_candidate"})
            else:
                write_field(conn,entry_id,"article",exception["article_note"],"editorial",source,review,{"source_candidate"})
            if "plural" in exception:
                write_field(conn,entry_id,"plural",exception["plural"],"editorial",source,review,{"source_candidate"})
            if "plural_note" in exception:
                write_field(conn,entry_id,"plural",exception["plural_note"],"editorial",source,review,{"editorial","source_candidate"})
            if "meaning" in exception:
                conn.execute("UPDATE entries SET english_meaning=?,v11_meaning=? WHERE entry_id=?",
                             (exception["meaning"],exception["meaning"],entry_id))
                write_field(conn,entry_id,"meaning",exception["meaning"],"editorial",source,review,{"editorial","reference_match","present"})
            if "base_lemma" in exception:
                conn.execute(
                    "INSERT INTO inflected_entry_reference(entry_id,base_lemma,form_note,source_url) VALUES(?,?,?,?)",
                    (entry_id,exception["base_lemma"],exception["form_note"],exception["plural_url"])
                )
                rows=conn.execute("SELECT position,source_json FROM v11_article_bank WHERE lemma='Armen'").fetchall()
                if len(rows)!=1:
                    raise ValueError("Expected exactly one article-bank reference for Armen.")
                data=json.loads(rows[0]["source_json"])
                data["note"]=exception["article_note"]
                conn.execute("UPDATE v11_article_bank SET source_json=? WHERE position=?",
                             (json.dumps(data,ensure_ascii=False,sort_keys=True),rows[0]["position"]))
        unhandled=conn.execute("SELECT e.lemma FROM field_checks f JOIN entries e USING(entry_id) WHERE f.field='article' AND f.status='source_candidate'").fetchall()
        if unhandled:
            raise ValueError("Unreviewed candidate article fields remain: "+", ".join(r["lemma"] for r in unhandled))
        reviewed_examples=patch["reviewed_examples"]
        if len(reviewed_examples)!=35:
            raise ValueError("Review batch must contain 35 bilingual examples.")
        for item in reviewed_examples:
            row=conn.execute(
                "SELECT status,source,attribution,matching_evidence FROM examples WHERE entry_id=? AND german=? AND english=?",
                (item["entry_id"],item["german"],item["english"])
            ).fetchone()
            if not row or row["status"]!="source_candidate":
                raise ValueError(f"Candidate example not found as expected: {item['entry_id']} / {item['german']}")
            trusted=conn.execute(
                "SELECT COUNT(*) FROM examples WHERE entry_id=? AND status!='source_candidate' AND trim(german)!='' AND trim(english)!=''",
                (item["entry_id"],)
            ).fetchone()[0]
            if trusted:
                raise ValueError(f"Entry already has a trusted example: {item['entry_id']}")
        for item in reviewed_examples:
            row=conn.execute(
                "SELECT source,matching_evidence FROM examples WHERE entry_id=? AND german=? AND english=?",
                (item["entry_id"],item["german"],item["english"])
            ).fetchone()
            prior=parse_json(row["matching_evidence"])
            evidence={"prior_match_evidence":prior,"review":{"date":review_date,"note":item["note"],"method":"Sense, grammatical use, and English translation checked."}}
            conn.execute(
                "UPDATE examples SET status='reference_match',matching_evidence=? WHERE entry_id=? AND german=? AND english=? AND status='source_candidate'",
                (json.dumps(evidence,ensure_ascii=False,sort_keys=True),item["entry_id"],item["german"],item["english"])
            )
            field=field_row(conn,item["entry_id"],"example")
            if field and field["status"]=="source_candidate":
                conn.execute(
                    "UPDATE field_checks SET status='reference_match',evidence_json=? WHERE entry_id=? AND field='example'",
                    (json.dumps({"prior_evidence":parse_json(field["evidence_json"]),"review":{"date":review_date,"note":item["note"]}},ensure_ascii=False,sort_keys=True),item["entry_id"])
                )
        if conn.execute("PRAGMA foreign_key_check").fetchall():
            raise ValueError("Foreign-key validation failed.")
        if conn.execute("PRAGMA integrity_check").fetchone()[0] != "ok":
            raise ValueError("Final SQLite integrity check failed.")
        article_candidates=conn.execute("SELECT COUNT(*) FROM field_checks WHERE field='article' AND status='source_candidate'").fetchone()[0]
        example_candidates=conn.execute("SELECT COUNT(*) FROM field_checks WHERE field='example' AND status='source_candidate'").fetchone()[0]
        if article_candidates or example_candidates != 3598:
            raise ValueError(f"Unexpected remaining candidate counts: articles={article_candidates}, examples={example_candidates}.")
        conn.commit()
        counts=dict(conn.execute("SELECT status,COUNT(*) FROM field_checks GROUP BY status"))
    print(json.dumps({
        "batch_id":patch["batch_id"],
        "auto_article_reference_matches":len(auto_ids),
        "duden_article_resolutions":len(patch["article_exceptions"]),
        "reviewed_bilingual_examples":len(reviewed_examples),
        "held_examples":patch["held_examples"],
        "remaining_article_candidates":article_candidates,
        "remaining_example_candidates":example_candidates,
        "field_check_status_counts":counts,
        "reviewed_database_sha256":sha256(output_db)
    },ensure_ascii=False,indent=2))

if __name__=="__main__":
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument("input_database",type=Path)
    parser.add_argument("patch",type=Path)
    parser.add_argument("output_database",type=Path)
    parser.add_argument("gender_index",type=Path)
    args=parser.parse_args()
    apply(args.input_database,args.output_database,args.patch,args.gender_index)