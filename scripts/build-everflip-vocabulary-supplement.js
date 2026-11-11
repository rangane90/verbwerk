'use strict';

const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const runtimeText = fs.readFileSync(path.join(root, 'vocabulary-general-a1-c2.js'), 'utf8');
const assignment = runtimeText.indexOf('window.VW_GENERAL_DATA');
const equals = runtimeText.indexOf('=', assignment);
const end = runtimeText.lastIndexOf(';');
if (assignment < 0 || equals < 0 || end <= equals) throw new Error('Could not read the current general vocabulary runtime.');
const runtime = JSON.parse(runtimeText.slice(equals + 1, end).trim());
const normalize = value => String(value || '').toLocaleLowerCase('de-DE').normalize('NFC').trim();
const ownSourcePacks = new Set(['verbwerk_wikidata_supplement_v1', 'verbwerk_everflip_de_supplement_v1']);
const existing = new Set(runtime.entries.filter(entry => !ownSourcePacks.has(entry.source_pack)).map(entry => normalize(entry.lemma)));
const packDir = path.join(root, 'data', 'vocabulary', 'general-a1-c2', 'source-packs', 'verbwerk_everflip_de_supplement_v1');
const cards = JSON.parse(fs.readFileSync(path.join(packDir, 'source-cards.json'), 'utf8'));
const authoring = JSON.parse(fs.readFileSync(path.join(packDir, 'authoring.json'), 'utf8'));
const candidates = cards.filter(card => !existing.has(normalize(card.front)));
const candidateKeys = candidates.map(card => normalize(card.front));
if (new Set(candidateKeys).size !== candidateKeys.length) throw new Error('The filtered source cards contain duplicate German headwords.');
const annotations = new Set(Object.keys(authoring).map(normalize));
const missingNotes = candidateKeys.filter(key => !authoring[key]);
const unusedNotes = [...annotations].filter(key => !candidateKeys.includes(key));
if (missingNotes.length || unusedNotes.length) {
  throw new Error('Source and editorial record mismatch. Missing: ' + missingNotes.join(', ') + '; unused: ' + unusedNotes.join(', '));
}

const entries = candidates.map(card => {
  const key = normalize(card.front);
  const note = authoring[key];
  const isNoun = note.pos === 'noun';
  const displayForm = isNoun ? note.article + ' ' + card.front : card.front;
  const pluralForms = note.plural ? [note.plural] : [];
  const forms = isNoun && note.plural ? [
    { surface: displayForm, number: 'sg', case: 'nom', role: 'core', tags: {} },
    { surface: note.plural, number: 'pl', case: 'nom', role: 'core', tags: {} }
  ] : (note.prefix ? [
    { surface: card.front, number: null, case: null, role: 'core', tags: { prefix: note.prefix } }
  ] : []);
  const slug = key.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/ß/g, 'ss').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  const entry = {
    id: 'supplement-everflip-' + slug,
    concept_id: 'everflip-de-' + slug,
    source_pack: 'verbwerk_everflip_de_supplement_v1',
    entry_kind: 'vocabulary',
    lemma: card.front,
    display_form: displayForm,
    part_of_speech: note.pos,
    article: isNoun ? note.article : null,
    gender: isNoun ? note.gender : 'none',
    plural_forms: pluralForms,
    forms,
    english_terms: [{ term: note.meaning, lemma: note.meaning, primary: true, meaning_status: 'exact' }],
    meaning: note.meaning,
    german_definition: note.definition,
    german_examples: [{ sentence: note.exampleDe, translation_language: 'en', translation: note.exampleEn }],
    status: 'approved',
    is_active: true,
    is_primary: true,
    provenance: {
      source_dataset: 'EverFlip Multilingual Flashcard Corpus',
      dataset_version: '1.0.0',
      source_release_commit: '0f76c389e3cbcddd61408b433ea6df8d8c9b1613',
      source_url: 'https://everflip.app/dataset',
      source_license: 'CC-BY-4.0',
      source_deck: card.deck_name,
      source_card_front: card.front,
      source_card_meaning: card.meaning_en,
      modifications: 'Verbwerk selected this German card, edited its English gloss for a standalone learner entry, and added a German definition, original example and translation' 
    }
  };
  if (note.usageNote) entry.usage_note = note.usageNote;
  return entry;
});

const packId = 'verbwerk.everflip.de.supplement.v1';
const pack = { schema_version: 1, pack_id: packId, entries };
const manifest = {
  pack_id: packId,
  pack_role: 'supplemental',
  version: '1.0.0',
  entry_count: entries.length,
  languages_target_supported: ['de'],
  gloss_languages_supported: ['en'],
  source_dataset: 'EverFlip Multilingual Flashcard Corpus',
  source_dataset_version: '1.0.0',
  source_release_commit: '0f76c389e3cbcddd61408b433ea6df8d8c9b1613',
  source_license: 'CC-BY-4.0',
  source_attribution: 'EverFlip (2026), EverFlip Multilingual Flashcard Corpus, version 1.0.0, licensed under CC BY 4.0. https://everflip.app/dataset',
  source_url: 'https://everflip.app/dataset',
  source_license_url: 'https://creativecommons.org/licenses/by/4.0/',
  source_card_count: cards.length,
  learner_text_license: 'Verbwerk original German definitions, example sentences and English translations in this supplement are released under CC BY 4.0.',
  retrieved_at: '2026-11-01',
  changes_made: 'Filtered the German-language cards to standalone headwords absent from the pinned General Library; excluded grammar patterns and existing lemmas. Rewrote the source English meanings as concise learner glosses, then added original German definitions, examples and translations; supplied noun articles and plural forms where relevant.',
  notes: 'This is an additional flat General Library pack. CEFR levels and source deck names are retained only in source provenance and are not used as Library filters or labels.'
};
fs.writeFileSync(path.join(packDir, 'content.json'), JSON.stringify(pack, null, 2) + '\n', 'utf8');
fs.writeFileSync(path.join(packDir, 'manifest.json'), JSON.stringify(manifest, null, 2) + '\n', 'utf8');
console.log('Built EverFlip supplement with ' + entries.length + ' entries absent from the current General Library.');