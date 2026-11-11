'use strict';

const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const root = path.resolve(__dirname, '..');
const pilotContext = { window: {} };
vm.createContext(pilotContext);
vm.runInContext(fs.readFileSync(path.join(root, 'vocabulary-pilot.js'), 'utf8'), pilotContext);
const runtimeText = fs.readFileSync(path.join(root, 'vocabulary-general-a1-c2.js'), 'utf8');
const start = runtimeText.indexOf('window.VW_GENERAL_DATA');
const equals = runtimeText.indexOf('=', start);
const end = runtimeText.lastIndexOf(';');
if (start < 0 || equals < 0 || end <= equals) throw new Error('Could not read the current general vocabulary runtime.');
const general = JSON.parse(runtimeText.slice(equals + 1, end).trim());
const normalize = value => String(value || '').toLocaleLowerCase('de-DE').normalize('NFC').trim();
const supplementalPacks = new Set(['verbwerk_wikidata_supplement_v1', 'verbwerk_everflip_de_supplement_v1']);
const existing = new Set(general.entries.filter(entry => !supplementalPacks.has(entry.source_pack)).map(entry => normalize(entry.lemma)));

const learnerContent = {
  'v7:VW_ARTICLES:1': ['Tragbares Telefon für Anrufe, Nachrichten und andere digitale Funktionen.', 'Mein Handy ist fast leer, deshalb lade ich es auf.', 'My phone is nearly out of battery, so I am charging it.', 'The usual German word for a mobile phone is Handy.'],
  'v7:VW_ARTICLES:2': ['Behältnis, das man tragen und zum Aufbewahren oder Transportieren von Gegenständen benutzen kann.', 'Meine Schlüssel sind in der Tasche.', 'My keys are in the bag.'],
  'v7:VW_ARTICLES:4': ['Räume, in denen eine Person oder eine Familie lebt.', 'Wir suchen eine größere Wohnung.', 'We are looking for a larger apartment.'],
  'v7:VW_ARTICLES:6': ['Tätigkeit, für die man Zeit und Mühe aufwendet; oft als Beruf.', 'Nach der Arbeit gehe ich nach Hause.', 'I go home after work.', 'Arbeit is usually uncountable when it means work in general. The plural Arbeiten can refer to tasks or pieces of work.'],
  'v7:VW_ARTICLES:7': ['Dauerhafte Tätigkeit, mit der eine Person ihren Lebensunterhalt verdient oder eine berufliche Aufgabe erfüllt.', 'Welchen Beruf möchtest du später ausüben?', 'What profession would you like to pursue later?'],
  'v7:VW_ARTICLES:11': ['Dokument, das die Kosten für gekaufte Waren oder erbrachte Dienstleistungen auflistet.', 'Die Rechnung kommt heute per E-Mail.', 'The invoice will arrive by email today.'],
  'v7:VW_ARTICLES:15': ['Dokument oder Papier, das für eine Information, einen Antrag oder eine Entscheidung gebraucht wird.', 'Bitte bringen Sie alle Unterlagen zum Termin mit.', 'Please bring all the documents to the appointment.'],
  'v7:VW_ARTICLES:19': ['Prozess, in dem etwas entsteht oder sich im Laufe der Zeit verändert.', 'Die Entwicklung des Projekts läuft nach Plan.', 'The development of the project is on schedule.'],
  'v7:VW_ARTICLES:20': ['Organisation, die Waren herstellt oder Dienstleistungen anbietet.', 'Das Unternehmen sucht neue Mitarbeiter.', 'The company is looking for new employees.'],
  'v7:VW_ARTICLES:21': ['Person, die in einer Organisation oder an einer gemeinsamen Aufgabe mitarbeitet.', 'Die Mitarbeiter treffen sich um neun Uhr.', 'The employees meet at nine o’clock.', 'This record uses the masculine form Mitarbeiter. The feminine form is Mitarbeiterin.'],
  'v7:VW_ARTICLES:22': ['Geplantes Treffen, bei dem mehrere Personen Informationen austauschen oder etwas besprechen.', 'Die Besprechung beginnt um neun Uhr.', 'The meeting starts at nine o’clock.'],
  'v7:VW_ARTICLES:24': ['Arbeit oder Problem, das erledigt oder gelöst werden soll.', 'Meine Aufgabe ist, den Bericht zu prüfen.', 'My task is to review the report.'],
  'v7:VW_ARTICLES:25': ['Etwas, das falsch gemacht wurde, oder eine Abweichung vom richtigen Ergebnis.', 'In diesem Text ist ein kleiner Fehler.', 'There is a small mistake in this text.'],
  'v7:VW_WORDS:19': ['Für eine bestimmte Aufgabe oder einen bestimmten Bereich verantwortlich.', 'Frau Keller ist für die Anmeldung zuständig.', 'Ms Keller is responsible for registration.', 'Common pattern: zuständig sein für + accusative.'],
  'v7:VW_WORDS:20': ['Ein Ziel erreichend oder gute Ergebnisse erzielend.', 'Unser Team war mit dem Projekt erfolgreich.', 'Our team was successful with the project.'],
  'v7:VW_WORDS:24': ['Leitet eine Zeitangabe ein und bedeutet, dass etwas in einem bestimmten Zeitraum geschieht.', 'Während des Kurses machen wir eine kurze Pause.', 'We take a short break during the course.', 'In standard written German, während is commonly followed by the genitive: während des Kurses.'],
  'v7:VW_WORDS:25': ['Gibt den Grund für eine Handlung oder einen Zustand an.', 'Wegen des Wetters bleiben wir heute zu Hause.', 'Because of the weather, we are staying home today.', 'Standard written German usually uses the genitive after wegen; the dative is also common in everyday speech.'],
  'v7:VW_WORDS:26': ['Zeigt eine Begleitung, ein verwendetes Mittel oder ein gemeinsames Handeln an.', 'Ich fahre mit dem Bus zur Arbeit.', 'I take the bus to work.', 'Mit takes the dative: mit dem Bus.'],
  'v7:VW_WORDS:27': ['Zeigt, für wen oder wofür etwas bestimmt ist.', 'Dieses Geschenk ist für dich.', 'This gift is for you.', 'Für takes the accusative: für dich.'],
  'v7:VERBS:3': ['Bei einer Organisation um eine Stelle oder einen Platz bitten.', 'Sie bewirbt sich um eine Stelle bei einer Bank.', 'She is applying for a position at a bank.', 'Reflexive verb: sich bewerben um + accusative (the position) and bei + dative (the organization).'],
  'v7:VERBS:6': ['Etwas wieder ins Gedächtnis rufen oder noch im Gedächtnis haben.', 'Ich erinnere mich an unseren ersten Urlaub.', 'I remember our first holiday.', 'Reflexive verb: sich erinnern an + accusative.'],
  'v7:VERBS:7': ['Sich um eine Person oder Sache sorgen und dafür sorgen, dass sie gut versorgt wird.', 'Er kümmert sich um die Kinder.', 'He takes care of the children.', 'Reflexive verb: sich kümmern um + accusative.'],
  'v7:VERBS:8': ['Eigentum einer Person sein oder einer Person beziehungsweise Gruppe zugeordnet sein.', 'Das Fahrrad gehört meiner Schwester.', 'The bicycle belongs to my sister.', 'The person or owner is in the dative: meiner Schwester.'],
  'L408869': ['In kurzer Zeit; nicht lange von jetzt an.', 'Bald beginnt der Film.', 'The film starts soon.']
};
const partOfSpeech = { Noun: 'noun', Verb: 'verb', Adjective: 'adj', Preposition: 'preposition', Adverb: 'adv' };
const candidates = pilotContext.window.VW_PILOT_DATA.filter(entry => !existing.has(normalize(entry.lemma)));
if (candidates.length !== 24) throw new Error('Expected 24 absent pilot entries; found ' + candidates.length + '.');
const entries = candidates.map(entry => {
  const lexemeId = entry.wikidata && entry.wikidata.lexemeId;
  const editorial = learnerContent[entry.sourceRecord || lexemeId];
  if (!lexemeId || !editorial) throw new Error('Missing sourced learner content for ' + entry.lemma + '.');
  const [germanDefinition, sentence, translation, usageNote] = editorial;
  const pos = partOfSpeech[entry.kind];
  if (!pos) throw new Error('Unsupported word class for ' + entry.lemma + ': ' + entry.kind);
  const isNoun = pos === 'noun';
  const plural = isNoun ? String(entry.plural || '').replace(/^(die|der|das)\s+/i, '').trim() : '';
  const forms = isNoun && plural ? [
    { surface: entry.word, number: 'sg', case: 'nom', role: 'core', tags: {} },
    { surface: 'die ' + plural, number: 'pl', case: 'nom', role: 'core', tags: {} }
  ] : [];
  const result = {
    id: 'supplement-wikidata-' + lexemeId,
    concept_id: 'wikidata-' + lexemeId,
    source_pack: 'verbwerk_wikidata_supplement_v1',
    entry_kind: 'vocabulary',
    lemma: entry.lemma,
    display_form: entry.word || entry.lemma,
    part_of_speech: pos,
    article: isNoun ? entry.article : null,
    gender: isNoun ? entry.wikidata.gender : 'none',
    plural_forms: plural ? ['die ' + plural] : [],
    forms,
    english_terms: [{ term: entry.meaning, lemma: entry.meaning, primary: true, meaning_status: 'exact' }],
    meaning: entry.meaning,
    german_definition: germanDefinition,
    german_examples: [{ sentence, translation_language: 'en', translation }],
    status: 'approved',
    is_active: true,
    is_primary: true,
    provenance: {
      wikidata_lexeme_id: lexemeId,
      wikidata_uri: entry.wikidata.uri.replace('http://', 'https://'),
      wikidata_license: entry.wikidata.license,
      verbwerk_source_record: entry.sourceRecord || null,
      meaning_source: entry.meaningSource || 'Wikidata English gloss with a Verbwerk-authored learner definition'
    }
  };
  if (usageNote) result.usage_note = usageNote;
  return result;
});
const packId = 'verbwerk.wikidata.supplement.v1';
const pack = { schema_version: 1, pack_id: packId, entries };
const manifest = {
  pack_id: packId,
  pack_role: 'supplemental',
  version: '1.0.0',
  entry_count: entries.length,
  languages_target_supported: ['de'],
  gloss_languages_supported: ['en'],
  wikidata_license: 'CC0-1.0',
  learner_text_license: 'Verbwerk project content; newly written German definitions and example sentences are released under CC BY 4.0 for this supplement.',
  source_url: 'https://www.wikidata.org/wiki/Wikidata:Licensing',
  retrieved_at: '2026-10-31',
  notes: 'Adds approved Wikidata lexemes absent from the pinned Lexicon snapshot. The 50-word pilot remains a separate screen; this pack has no CEFR assignments or category tags.'
};
const packDir = path.join(root, 'data', 'vocabulary', 'general-a1-c2', 'source-packs', 'verbwerk_wikidata_supplement_v1');
fs.mkdirSync(packDir, { recursive: true });
fs.writeFileSync(path.join(packDir, 'content.json'), JSON.stringify(pack, null, 2) + '\n', 'utf8');
fs.writeFileSync(path.join(packDir, 'manifest.json'), JSON.stringify(manifest, null, 2) + '\n', 'utf8');
console.log('Built supplemental source pack with ' + entries.length + ' entries absent from the current General Library.');