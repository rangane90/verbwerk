"use strict";

const assert = require("node:assert/strict");
const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const directory = path.resolve(__dirname, "..");
const read = file => fs.readFileSync(path.join(directory, file), "utf8");
const html = read("index.html");
for (const script of html.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/g)) new vm.Script(script[1]);

const detail = {innerHTML: "", querySelector: () => null};
const context = vm.createContext({
  document: {getElementById: id => id === "verbDetailContent" ? detail : null},
  renderExampleSentence: (de, en) => "<p>" + de + " | " + en + "</p>",
  setLibraryKind() {},
});
context.window = context;
const run = code => vm.runInContext(code, context);
const segment = (source, from, to) => source.slice(source.indexOf(from), source.indexOf(to, source.indexOf(from)));
const lines = html.split(/\r?\n/);
const verbs = lines.find(line => line.startsWith("const VERBS ="));
assert.ok(verbs);
run(verbs);
run(segment(html, "const VW_ARTICLES=[", "let vwTrack="));
run(segment(html, "function esc(s)", "function showPage("));
run(segment(html, "function renderExampleSet(", "window.exampleColorLegend="));
run("window.VW_APP_ACCESS={baseArticles:VW_ARTICLES,state:{}}; let expandedLessonVerbs;");
run(segment(html, "window.configureExpandedVerbLessons=function", "function courseLessonDays("));

const asset = "vocabulary-latest-database.js";
for (const file of ["vocabulary-general-a1-c2.js", "vocabulary-pilot.js", "vocabulary-wordly-de.js", "vocabulary-gender-index.js", asset]) {
  run(read(file));
}
const general = read("vocabulary-general-ui.js");
run(general.slice(0, general.indexOf("  function setCount(")) + "\nwindow.auditGeneral={active,articleLessonWords,articlePluralLabel};\n})();");
const unified = read("vocabulary-unified-library.js");
const marker = "  populateFilters();";
assert.equal(unified.split(marker).length, 2);
run(unified.replace(marker, "  window.auditUnified={entries,examplesOf};\n" + marker));

const payload = context.VW_LATEST_VOCABULARY;
const {entries, examplesOf} = context.auditUnified;
const {active, articleLessonWords, articlePluralLabel} = context.auditGeneral;
const manifest = JSON.parse(read("vocabulary-manifest.json")).latest_database;
assert.equal(crypto.createHash("sha256").update(read(asset), "utf8").digest("hex"), manifest.asset_sha256);
assert.equal(payload.metadata.version, "2026-11-11.4");
assert.equal(payload.metadata.trusted_bilingual_example_count, 5396);
assert.equal(payload.metadata.candidate_bilingual_example_count, 0);
const reviewedById = new Map(payload.entries.map(row => [row.entry_id, row]));
for (const item of JSON.parse(read("data/vocabulary/review_batches/v11-vocabulary-review-01.json")).reviewed_examples) {
  const row = reviewedById.get(item.entry_id);
  assert.ok(row.examples.some(example => example.german === item.german && example.english === item.english && example.status === "reference_match"), item.entry_id);
}
assert.deepEqual(Array.from(reviewedById.get("frequency:2921").grammar.article), ["das"]);
assert.deepEqual(Array.from(reviewedById.get("frequency:2921").noun.plurals), ["Biester"]);
assert.deepEqual(Array.from(reviewedById.get("frequency:3114").grammar.article), ["die"]);
assert.deepEqual(Array.from(reviewedById.get("frequency:3114").noun.plurals), ["Laken"]);
assert.deepEqual(Array.from(reviewedById.get("frequency:4557").grammar.article), ["der"]);
assert.deepEqual(Array.from(reviewedById.get("frequency:4557").noun.plurals), ["Diner"]);
assert.deepEqual(Array.from(reviewedById.get("frequency:3739").grammar.article), ["der"]);
assert.deepEqual(Array.from(reviewedById.get("frequency:3739").noun.plurals), ["Schöße"]);
assert.equal(reviewedById.get("frequency:1015").base_lemma, "Arm");
assert.match(reviewedById.get("frequency:1015").noun.article_note, /der Arm/);
assert.match(reviewedById.get("frequency:3450").noun.article_note, /fixed expressions/);
assert.equal(payload.entries.filter(row => row.word_class === "noun").length, 2620);
assert.equal(entries.length, 5396);
assert.equal(new Set(entries.map(row => row.key)).size, 5396);
assert.equal(context.VW_UNIFIED_VERB_ENTRIES.length, 1190);
assert.equal(Object.keys(payload.routes.frequency).length, 5000);
assert.equal(Object.keys(payload.routes.general).length, 891);
assert.equal(Object.keys(payload.routes.pilot).length, 50);
assert.equal(Object.keys(payload.routes.course).length, 28);
assert.equal(active().length, 891);
for (const [index, item] of entries.entries()) {
  const entry = payload.entries[index];
  assert.equal(item.key, entry.entry_id);
  assert.equal(item.meaning, entry.english_meaning);
  assert.equal(item.part_of_speech, entry.word_class);
  assert.ok(examplesOf(item).some(example => example.sentence && example.translation), item.key);
}
assert.notEqual(payload.routes.frequency["3465"], payload.routes.general["lex-de-beurteilen"]);
assert.equal(context.VW_ARTICLE_BANK.length, 2599);
assert.equal(context.VW_ARTICLE_PRACTICE_BANK.length, 2444);
assert.equal(context.VW_ARTICLE_LESSON_SLOTS.length, 2449);
assert.equal(context.VW_ARTICLE_LESSON_SLOTS.filter(item => !item.eligible).length, 5);
for (let i = 0; i < context.VW_ARTICLE_LESSON_SLOTS.length; i += 5) {
  assert.ok(articleLessonWords(i, i + 5).length);
}
for (const row of context.VW_ARTICLE_BANK) {
  assert.ok(row.p || row.numberNote || row.candidatePlural, row.n);
}
assert.equal(articlePluralLabel(context.VW_ARTICLE_BANK.find(row => row.n === "Bank")), "Plural: Bänke");
assert.match(context.VW_ARTICLE_BANK.find(row => row.n === "Iris").numberNote, /Iriden/);
assert.doesNotMatch(articlePluralLabel(context.VW_ARTICLE_BANK.find(row => row.n === "Dank")), /^Plural:/);
assert.equal(context.VW_ARTICLE_BANK.find(row => row.n === "Tor").a, "das");
assert.equal(context.VW_ARTICLE_BANK.find(row => row.n === "Cross").a, "der");
assert.equal(context.VW_ARTICLE_PRACTICE_BANK.find(row => row.n === "Tee").a, "der");
assert.equal(context.VW_ARTICLE_PRACTICE_BANK.find(row => row.n === "Kaffee").a, "der");
assert.equal(context.VW_ARTICLE_PRACTICE_BANK.find(row => row.n === "Tag").a, "der");
assert.equal(run("expandedLessonVerbs.length"), 1190);
assert.equal(run("expandedLessonVerbs.filter(row=>row.studyEntry?.base_lemma).length"), 8);
assert.ok(run("expandedLessonVerbs.slice(0,28).every((row,i)=>row.id===VERBS[i].id && row.examples.length)"));

for (const [kind, id, expected] of [
  ["frequency", "967", /to arrest/],
  ["article", "Tor", /das Tor/],
  ["unified", "frequency:841", /Open bringen/],
  ["unified", "frequency:2321", /delicious/],
  ["general", "lex-de-gut", /Das ist ein gutes Fahrrad/],
]) {
  context.renderVocabularyDetail(kind, id);
  assert.match(detail.innerHTML, expected);
  assert.doesNotMatch(detail.innerHTML, /\[object Object\]/);
}
const candidate = payload.entries.find(row => Object.keys(row.candidate_grammar).length);
assert.ok(candidate);
context.renderVocabularyDetail("unified", candidate.entry_id);
assert.match(detail.innerHTML, /Grammar for review/);
assert.doesNotMatch(detail.innerHTML, /Example for review/);
assert.equal(payload.entries.filter(row => row.candidate_example).length, 0);
assert.equal(payload.entries.filter(row => row.candidate_example).length, manifest.candidate_bilingual_example_count);
assert.equal(reviewedById.get("frequency:1644").word_class, "adjective");
assert.match(reviewedById.get("frequency:1646").english_meaning, /^spring/);
assert.match(reviewedById.get("frequency:1659").english_meaning, /^to serve/);
assert.match(reviewedById.get("frequency:3027").english_meaning, /^politician/);
assert.match(reviewedById.get("frequency:3037").english_meaning, /^airplane/);
assert.equal(reviewedById.get("frequency:4548").word_class, "noun");
assert.ok(reviewedById.get("frequency:4548").examples.some(example => example.german === "Sie schlug einen Cross."));

const worker = read("sw.js");
for (const url of ["vocabulary-latest-database.js?v=4", "vocabulary-general-ui.js?v=36", "vocabulary-unified-library.js?v=10"]) {
  assert.ok(html.includes(url) && worker.includes(url), url);
}
console.log("PASS: 5,396 stable entries, 5,000 frequency routes, course and article schedules, shared details, candidate labels and cache versions.");

