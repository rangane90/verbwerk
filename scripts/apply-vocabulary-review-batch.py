"""Apply a provenance-preserving reviewed batch to a copied Verbwerk study database."""
import argparse
import hashlib
import json
import shutil
import sqlite3
from pathlib import Path

def sha256(path):
    h=hashlib.sha256()
    with path.open("rb") as f:
        for chunk in iter(lambda:f.read(1024*1024),b""):
            h.update(chunk)
    return h.hexdigest()

def parse(value):
    try: return json.loads(value) if value else None
    except (TypeError,ValueError): return value

def field(conn, entry_id, name):
    return conn.execute("SELECT status,value_json,source,evidence_json FROM field_checks WHERE entry_id=? AND field=?",(entry_id,name)).fetchone()

def set_field(conn, entry_id, name, value, status, source, review, allowed):
    row=field(conn,entry_id,name)
    if row is None:
        if not review.get("create_if_missing"):
            raise ValueError(f"Missing field {entry_id}:{name}")
        conn.execute("INSERT INTO field_checks(entry_id,field,status,value_json,source,evidence_json) VALUES(?,?,?,?,?,?)",
                     (entry_id,name,status,json.dumps(value,ensure_ascii=False),source,json.dumps({"review":review},ensure_ascii=False,sort_keys=True)))
        return
    if row["status"] not in allowed:
        raise ValueError(f"Unexpected field state {entry_id}:{name}={row['status']}")
    evidence={"prior_evidence":parse(row["evidence_json"]),"review":{k:v for k,v in review.items() if k!="create_if_missing"}}
    conn.execute("UPDATE field_checks SET status=?,value_json=?,source=?,evidence_json=? WHERE entry_id=? AND field=?",
                 (status,json.dumps(value,ensure_ascii=False),source,json.dumps(evidence,ensure_ascii=False,sort_keys=True),entry_id,name))

def apply(db_in, patch_path, db_out):
    patch=json.loads(patch_path.read_text(encoding="utf-8-sig"))
    if sha256(db_in)!=patch["input_database_sha256"]: raise ValueError("Input database hash mismatch.")
    if db_in.resolve()==db_out.resolve(): raise ValueError("Output must be a separate copy.")
    db_out.parent.mkdir(parents=True,exist_ok=True); shutil.copy2(db_in,db_out)
    accepted=replaced=plural_count=0
    with sqlite3.connect(db_out) as conn:
        conn.row_factory=sqlite3.Row; conn.execute("PRAGMA foreign_keys=ON")
        if conn.execute("PRAGMA integrity_check").fetchone()[0]!="ok": raise ValueError("Input copy failed integrity check.")
        conn.execute("BEGIN IMMEDIATE")
        for item in patch.get("accepted_examples",[]):
            row=conn.execute("SELECT status,matching_evidence FROM examples WHERE entry_id=? AND german=? AND english=?",(item["entry_id"],item["german"],item["english"])).fetchone()
            if not row or row["status"]!="source_candidate": raise ValueError("Expected candidate not found: "+item["entry_id"])
            trusted=conn.execute("SELECT COUNT(*) FROM examples WHERE entry_id=? AND status IN ('editorial','course_reviewed','reference_match','inherited') AND german!='' AND english!=''",(item["entry_id"],)).fetchone()[0]
            if trusted: raise ValueError("Accepted example entry already has a trusted pair: "+item["entry_id"])
            ev={"prior_match_evidence":parse(row["matching_evidence"]),"review":{"date":patch["review_date"],"decision":"reference_match","note":item["note"],"method":"German meaning and grammatical use, English translation, and entry sense checked."}}
            conn.execute("UPDATE examples SET status='reference_match',matching_evidence=? WHERE entry_id=? AND german=? AND english=?",
                         (json.dumps(ev,ensure_ascii=False,sort_keys=True),item["entry_id"],item["german"],item["english"]))
            f=field(conn,item["entry_id"],"example")
            if f and f["status"]=="source_candidate":
                conn.execute("UPDATE field_checks SET status='reference_match',evidence_json=? WHERE entry_id=? AND field='example'",
                             (json.dumps({"prior_evidence":parse(f["evidence_json"]),"review":{"date":patch["review_date"],"note":item["note"]}},ensure_ascii=False,sort_keys=True),item["entry_id"]))
            accepted+=1
        for item in patch.get("held_examples",[]):
            row=conn.execute("SELECT status,matching_evidence FROM examples WHERE entry_id=? AND german=?",(item["entry_id"],item["german"])).fetchone()
            if not row or row["status"]!="source_candidate": raise ValueError("Held source example not found: "+item["entry_id"])
            ev={"prior_match_evidence":parse(row["matching_evidence"]),"review":{"date":patch["review_date"],"decision":"held/replaced","reason":item["reason"]}}
            conn.execute("UPDATE examples SET matching_evidence=? WHERE entry_id=? AND german=? AND status='source_candidate'",
                         (json.dumps(ev,ensure_ascii=False,sort_keys=True),item["entry_id"],item["german"]))
        for item in patch.get("editorial_examples",[]):
            prior=conn.execute("SELECT english,status,source,attribution,matching_evidence FROM examples WHERE entry_id=? AND german=?",(item["entry_id"],item["german"])).fetchone()
            review={"date":patch["review_date"],"note":item["note"],"source_evidence_url":item.get("evidence_url"),"method":"Original educational example and translation written for Verbwerk and checked against the entry meaning."}
            if prior:
                if prior["status"]!="source_candidate": raise ValueError("Cannot replace non-candidate example: "+item["entry_id"])
                ev={"prior_candidate":{"english":prior["english"],"source":prior["source"],"attribution":prior["attribution"],"matching_evidence":parse(prior["matching_evidence"])},"review":review}
                conn.execute("UPDATE examples SET english=?,status='editorial',source='Verbwerk editorial',attribution='',matching_evidence=? WHERE entry_id=? AND german=?",
                             (item["english"],json.dumps(ev,ensure_ascii=False,sort_keys=True),item["entry_id"],item["german"]))
            else:
                ev={"review":review}
                conn.execute("INSERT INTO examples(entry_id,german,english,status,source,attribution,matching_evidence) VALUES(?,?,?,'editorial','Verbwerk editorial','',?)",
                             (item["entry_id"],item["german"],item["english"],json.dumps(ev,ensure_ascii=False,sort_keys=True)))
            f=field(conn,item["entry_id"],"example")
            if not f: raise ValueError("Missing example field check: "+item["entry_id"])
            if f["status"] not in {"source_candidate","reference_match","editorial"}: raise ValueError("Unexpected example field state: "+item["entry_id"])
            conn.execute("UPDATE field_checks SET status='editorial',evidence_json=? WHERE entry_id=? AND field='example'",
                         (json.dumps({"prior_evidence":parse(f["evidence_json"]),"review":{"date":patch["review_date"],"note":item["note"],"source":"Verbwerk editorial"}},ensure_ascii=False,sort_keys=True),item["entry_id"]))
            replaced+=1
        for item in patch.get("retired_examples",[]):
            prior=conn.execute("SELECT english,status,source,attribution,matching_evidence FROM examples WHERE entry_id=? AND german=?",(item["entry_id"],item["german"])).fetchone()
            if not prior or prior["status"] not in {"editorial","course_reviewed","reference_match"}:
                raise ValueError("Cannot retire an untrusted or missing example: "+item["entry_id"])
            ev={"prior_example":{"english":prior["english"],"status":prior["status"],"source":prior["source"],"attribution":prior["attribution"],"matching_evidence":parse(prior["matching_evidence"])},
                "review":{"date":patch["review_date"],"decision":"retired/superseded","reason":item["reason"],"replacement_german":item.get("replacement_german")}}
            conn.execute("UPDATE examples SET english='',status='retired',matching_evidence=? WHERE entry_id=? AND german=?",
                         (json.dumps(ev,ensure_ascii=False,sort_keys=True),item["entry_id"],item["german"]))
        for item in patch.get("entry_updates",[]):
            entry_id,name,value=item["entry_id"],item["field"],item["value"]
            row=field(conn,entry_id,name)
            if not row or row["status"] not in {"source_candidate","present","reference_match","editorial"}:
                raise ValueError(f"Unexpected state for {entry_id}:{name}")
            review={"date":patch["review_date"],"decision":item["note"],"url":item.get("url")}
            set_field(conn,entry_id,name,value,"editorial",item.get("source","Verbwerk editorial"),review,{"source_candidate","present","reference_match","editorial"})
            if name=="meaning":
                conn.execute("UPDATE entries SET english_meaning=?,v11_meaning=? WHERE entry_id=?",(value,value,entry_id))
            elif name=="word_class":
                conn.execute("UPDATE entries SET word_class=?,v11_word_class=? WHERE entry_id=?",(value,value,entry_id))
        for item in patch.get("plural_reviews",[]):
            row=field(conn,item["entry_id"],"plural")
            if not row or row["status"]!="source_candidate": raise ValueError("Plural candidate not found: "+item["entry_id"])
            review={"date":patch["review_date"],"decision":item["note"],"url":item["url"],"method":"Sense checked against the referenced dictionary entry."}
            set_field(conn,item["entry_id"],"plural",item["value"],"reference_match",item["source"],review,{"source_candidate"})
            plural_count+=1
            if item.get("usage_note"):
                usage_review={"date":patch["review_date"],"decision":item["usage_note"],"url":item.get("url"),"create_if_missing":True}
                set_field(conn,item["entry_id"],"usage",item["usage_note"],"editorial",item.get("usage_source",item["source"]),usage_review,{"source_candidate","present","reference_match","editorial","course_reviewed","missing"})
        for item in patch.get("inflected_links",[]):
            if conn.execute("SELECT COUNT(*) FROM entries WHERE entry_id=?",(item["entry_id"],)).fetchone()[0]!=1:
                raise ValueError("Inflected entry not found: "+item["entry_id"])
            if conn.execute("SELECT COUNT(*) FROM entries WHERE lemma=? AND word_class='verb'",(item["base_lemma"],)).fetchone()[0]!=1:
                raise ValueError("Base verb not found uniquely: "+item["base_lemma"])
            if conn.execute("SELECT COUNT(*) FROM inflected_entry_reference WHERE entry_id=?",(item["entry_id"],)).fetchone()[0]:
                raise ValueError("Inflected link already exists: "+item["entry_id"])
            conn.execute("INSERT INTO inflected_entry_reference(entry_id,base_lemma,form_note,source_url) VALUES(?,?,?,?)",
                         (item["entry_id"],item["base_lemma"],item["form_note"],item["source_url"]))
        if conn.execute("PRAGMA foreign_key_check").fetchall(): raise ValueError("Foreign-key check failed.")
        if conn.execute("PRAGMA integrity_check").fetchone()[0]!="ok": raise ValueError("Final database integrity check failed.")
        conn.commit()
        candidate_entries=conn.execute("SELECT COUNT(*) FROM field_checks WHERE field='example' AND status='source_candidate'").fetchone()[0]
        plural_candidates=conn.execute("SELECT COUNT(*) FROM field_checks WHERE field='plural' AND status='source_candidate'").fetchone()[0]
        trusted_rows=conn.execute("SELECT status,COUNT(*) FROM field_checks WHERE field='example' AND status!='source_candidate' GROUP BY status").fetchall()
    print(json.dumps({"batch_id":patch["batch_id"],"accepted_candidate_examples":accepted,"replaced_bad_entries":replaced,
                      "reviewed_plural_fields":plural_count,"remaining_candidate_only_entries":candidate_entries,
                      "remaining_candidate_plural_fields":plural_candidates,"example_field_status_counts":dict((r["status"],r[1]) for r in trusted_rows),
                      "database_sha256":sha256(db_out)},ensure_ascii=False,indent=2))

if __name__=="__main__":
    ap=argparse.ArgumentParser(description=__doc__)
    ap.add_argument("database",type=Path);ap.add_argument("patch",type=Path);ap.add_argument("output_database",type=Path)
    a=ap.parse_args();apply(a.database,a.patch,a.output_database)
