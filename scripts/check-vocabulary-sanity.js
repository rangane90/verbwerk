'use strict';

const fs = require('node:fs');
const path = require('node:path');

const dataPath = path.resolve(__dirname, '..', 'vocabulary-general-a1-c2.js');
const source = fs.readFileSync(dataPath, 'utf8');
const assignment = source.indexOf('window.VW_GENERAL_DATA');
const equals = source.indexOf('=', assignment);
const end = source.lastIndexOf(';');
if (assignment < 0 || equals < 0 || end <= equals) {
  console.error('FAIL: Could not find the VW_GENERAL_DATA JSON assignment.');
  process.exit(1);
}

let data;
try {
  data = JSON.parse(source.slice(equals + 1, end).trim());
} catch (error) {
  console.error(`FAIL: Vocabulary JSON is invalid: ${error.message}`);
  process.exit(1);
}

const errors = [];
const warnings = [];
const entries = Array.isArray(data.entries) ? data.entries : [];
const active = entries.filter(entry => entry.status === 'approved' && entry.is_active !== false);

function readWindowJson(relativePath, variableName) {
  const file = path.resolve(__dirname, '..', relativePath);
  const text = fs.readFileSync(file, 'utf8');
  const assignmentIndex = text.indexOf('window.' + variableName);
  const equalsIndex = text.indexOf('=', assignmentIndex);
  const endIndex = text.lastIndexOf(';');
  if (assignmentIndex < 0 || equalsIndex < 0 || endIndex <= equalsIndex) throw new Error('Could not read ' + variableName + ' from ' + relativePath);
  return JSON.parse(text.slice(equalsIndex + 1, endIndex).trim());
}

let frequencyRows = [];
let nounGenderData = {entries:{}, metadata:{}};
try {
  frequencyRows = readWindowJson('vocabulary-wordly-de.js', 'VW_WORDLY_DE');
  nounGenderData = readWindowJson('vocabulary-gender-index.js', 'VW_GERMAN_NOUN_GENDERS');
} catch (error) {
  errors.push('Could not validate the frequency noun article index: ' + error.message);
}
const frequencyNouns = frequencyRows.filter(row => row.pos === 'noun');
const genderEntries = nounGenderData.entries || {};
let multiArticleFrequencyNouns = 0;
let notedFrequencyNouns = 0;
for (const noun of frequencyNouns) {
  const key = String(noun.lemma || '').toLocaleLowerCase('de-DE').normalize('NFC').trim();
  const gender = genderEntries[key];
  if (!gender) { errors.push('Frequency noun has no article-index entry: ' + noun.lemma); continue; }
  const articles = Array.isArray(gender.articles) ? gender.articles : [];
  if (articles.some(article => !['der','die','das'].includes(article))) errors.push('Invalid frequency noun article for ' + noun.lemma);
  if (!articles.length && !String(gender.note || '').trim()) errors.push('Frequency noun has neither an article nor a usage note: ' + noun.lemma);
  if (articles.length > 1) multiArticleFrequencyNouns++;
  if (!articles.length) notedFrequencyNouns++;
}
if (nounGenderData.metadata && nounGenderData.metadata.frequency_noun_count !== frequencyNouns.length) errors.push('Gender-index noun count does not match the frequency source.');
const allowedPartsOfSpeech = new Set([
  'verb', 'noun', 'adv', 'adj', 'chunk', 'preposition',
  'conjunction', 'interjection', 'numeral', 'particle', 'pronoun', 'det'
]);
const activeIds = new Set();
const lemmaGroups = new Map();
let nounCount = 0;
let missingPlural = 0;
let reviewedSingular = 0;

if (!data.metadata || typeof data.metadata !== 'object') errors.push('dataset metadata is missing');
if (data.metadata && data.metadata.count !== entries.length) {
  errors.push(`metadata count ${data.metadata.count} does not match ${entries.length} records`);
}
if (data.metadata && data.metadata.active_count !== active.length) {
  errors.push(`metadata active_count ${data.metadata.active_count} does not match ${active.length} active records`);
}

for (const [index, entry] of active.entries()) {
  const label = entry.id || `record #${index + 1}`;
  if (!entry.id) errors.push(`${label}: id is missing`);
  else if (activeIds.has(entry.id)) errors.push(`${label}: duplicate active id`);
  else activeIds.add(entry.id);

  const lemma = String(entry.lemma || entry.display_form || '').trim();
  if (!lemma) errors.push(`${label}: lemma/display_form is missing`);
  if (!String(entry.meaning || '').trim() && !(Array.isArray(entry.english_terms) && entry.english_terms.some(term => String(term && term.term || '').trim()))) {
    errors.push(`${label}: English meaning is missing`);
  }
  if (!String(entry.german_definition || '').trim()) errors.push(`${label}: German definition is missing`);
  if (!allowedPartsOfSpeech.has(entry.part_of_speech)) errors.push(`${label}: unexpected part_of_speech ${entry.part_of_speech}`);

  const examples = Array.isArray(entry.german_examples) ? entry.german_examples : [];
  if (!examples.some(example => String(example && example.sentence || '').trim())) errors.push(`${label}: German example sentence is missing`);

  if (entry.part_of_speech === 'noun') {
    nounCount++;
    if (!['der', 'die', 'das'].includes(entry.article)) errors.push(`${label}: noun article is missing or invalid`);
    const hasPlural = Array.isArray(entry.plural_forms) && entry.plural_forms.length > 0;
    if (entry.plural_usage === "singular_in_sense") {
      if (hasPlural || !String(entry.grammar_note || "").trim()) errors.push(label + ": inconsistent singular-use review");
      else reviewedSingular++;
    } else if (!hasPlural) missingPlural++;
  }

  if (lemma) {
    const key = lemma.toLocaleLowerCase('de-DE').normalize('NFC');
    if (!lemmaGroups.has(key)) lemmaGroups.set(key, []);
    lemmaGroups.get(key).push({ lemma, part: entry.part_of_speech, id: entry.id, reviewed: entry.sense_reviewed === true });
  }
}

if (nounCount && missingPlural) warnings.push(`${missingPlural} of ${nounCount} active nouns have no plural form in the source data`);
const duplicateGroups = [...lemmaGroups.values()].filter(group => group.length > 1);
const unresolvedGroups = duplicateGroups.filter(group => group.some(entry => !entry.reviewed));
if (unresolvedGroups.length) {
  const preview = unresolvedGroups.slice(0, 8).map(group => `${group[0].lemma} (${group.length})`).join(', ');
  warnings.push(`${unresolvedGroups.length} repeated lemma groups need sense-aware review; repeats can be valid homonyms or separate senses: ${preview}`);
}

if (errors.length) {
  console.error(`FAIL: ${errors.length} structural issue(s) in ${active.length} active entries.`);
  for (const error of errors.slice(0, 40)) console.error(`  - ${error}`);
  if (errors.length > 40) console.error(`  - ... ${errors.length - 40} more`);
  process.exit(1);
}

console.log(`PASS: ${entries.length} total records; ${active.length} approved, active entries.`);
console.log(`PASS: active IDs are unique; required meanings, German definitions, examples, word classes, and noun articles are present.`);
console.log(`PASS: all ${frequencyNouns.length} frequency nouns have article options or an explicit usage note (${multiArticleFrequencyNouns} multi-article; ${notedFrequencyNouns} note-only).`);
console.log("REVIEWED: " + reviewedSingular + " nouns taught in the singular and " + (duplicateGroups.length - unresolvedGroups.length) + " repeated lemma groups reviewed by sense.");
for (const warning of warnings) console.log(`REVIEW: ${warning}`);
console.log('LIMIT: structural checks do not prove that each translation, grammar label, or example is linguistically correct; those still need editorial review.');
