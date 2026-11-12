'use strict';

const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const root = path.resolve(__dirname, '..');
function readJsonAssignment(relativePath, variableName) {
  const text = fs.readFileSync(path.join(root, relativePath), 'utf8');
  const marker = 'window.' + variableName;
  const assignment = text.indexOf(marker);
  const equals = text.indexOf('=', assignment);
  const end = text.lastIndexOf(';');
  if (assignment < 0 || equals < 0 || end <= equals) throw new Error('Could not read ' + variableName);
  return JSON.parse(text.slice(equals + 1, end).trim());
}

const latest = readJsonAssignment('vocabulary-latest-database.js', 'VW_LATEST_VOCABULARY');
const general = readJsonAssignment('vocabulary-general-a1-c2.js', 'VW_GENERAL_DATA');
const wordly = readJsonAssignment('vocabulary-wordly-de.js', 'VW_WORDLY_DE');
const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const verbArray = html.match(/const VERBS\s*=\s*(\[[\s\S]*?\]);/);
if (!verbArray) throw new Error('Could not locate the course verb data in index.html');
const courseVerbs = JSON.parse(verbArray[1]);
const helperStart = html.indexOf('const exampleWordPattern=');
const helperEnd = html.indexOf('// Classify the senses in the curated corpus.', helperStart);
if (helperStart < 0 || helperEnd <= helperStart) throw new Error('Could not locate the example highlighter');
const helperSource = html.slice(helperStart, helperEnd) +
  '\nwindow.__exampleVocabulary=exampleVocabulary;' +
  '\nwindow.__exampleEnglishTerms=exampleEnglishTerms;' +
  '\nwindow.__exampleLatestTerms=exampleLatestTerms;' +
  '\nwindow.__exampleEnglishVariants=exampleEnglishVariants;' +
  '\nwindow.__exampleFindEnglishMatches=exampleFindEnglishMatches;' +
  '\nwindow.__exampleSentenceTokens=exampleSentenceTokens;' +
  '\nwindow.__exampleCompoundRecordAt=exampleCompoundRecordAt;' +
  '\nwindow.__exampleHasGermanDeterminerBefore=exampleHasGermanDeterminerBefore;';

const articleBank = (latest.article_bank || []).filter(function (row) { return row.browsable !== false; });
const sandbox = {
  window: { VW_GENERAL_DATA: general, VW_LATEST_VOCABULARY: latest, VW_WORDLY_DE: wordly, VW_ARTICLE_BANK: articleBank },
  document: { addEventListener: function () {} },
  esc: function (value) { return String(value).replace(/[&<>"']/g, function (character) { return ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[character]; }); },
  VERBS: courseVerbs
};
vm.createContext(sandbox);
vm.runInContext(helperSource, sandbox, { filename: 'index.html#example-highlighter' });
const renderExampleSentence = sandbox.window.renderExampleSentence;
const books = sandbox.window.__exampleVocabulary();
const morphologyCases = [
  { term: 'deal', kind: 'verb', includes: ['deals', 'dealt', 'dealing'], excludes: ['dealed', 'dealling'] },
  { term: 'open', kind: 'verb', includes: ['opens', 'opened', 'opening'], excludes: ['openned', 'openning'] },
  { term: 'walk', kind: 'verb', includes: ['walks', 'walked', 'walking'], excludes: ['walkes', 'walkked'] },
  { term: 'stop', kind: 'verb', includes: ['stops', 'stopped', 'stopping'], excludes: ['stoped'] },
  { term: 'try', kind: 'verb', includes: ['tries', 'tried', 'trying'], excludes: ['tryed'] },
  { term: 'fly', kind: 'verb', includes: ['flies', 'flew', 'flown', 'flying'], excludes: ['flyed'] },
  { term: 'set up', kind: 'verb', includes: ['set up', 'sets up', 'setting up'], excludes: ['setted up'] },
  { term: 'city', kind: 'noun', includes: ['cities'], excludes: ['citys'] },
  { term: 'can', kind: 'modal', includes: ['could'], excludes: ['cans'] }
].map(function (test) {
  const variants = sandbox.window.__exampleEnglishVariants(test.term, test.kind);
  const missing = test.includes.filter(function (value) { return !variants.includes(value); });
  const incorrect = test.excludes.filter(function (value) { return variants.includes(value); });
  if (missing.length || incorrect.length) throw new Error('English morphology failed for ' + test.term + ': ' + JSON.stringify({ missing: missing, incorrect: incorrect, variants: variants }));
  return { term: test.term, kind: test.kind, variants: variants };
});
const glossaryCases = [
  { source: 'to excuse (something or (formal) someone)', expected: ['excuse'] },
  { source: 'government/administration', expected: ['government','administration'] },
  { source: 'a (phone) call', expected: ['call'] },
  { source: 'trace (rest of something; (by extension) any small amount)', expected: ['trace'] }
].map(function (test) {
  const terms = sandbox.window.__exampleEnglishTerms({kind:'noun',lemma:'audit',englishTerms:[{term:test.source}]});
  const missing = test.expected.filter(function (term) { return !terms.includes(term); });
  if (missing.length) throw new Error('Gloss parsing failed for ' + test.source + ': ' + JSON.stringify({missing:missing,terms:terms}));
  return {source:test.source,terms:terms};
});

function decode(value) {
  return String(value || '').replace(/&amp;/g, '&').replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, "'");
}
function captures(source, regex, groups) {
  const output = [];
  let match;
  regex.lastIndex = 0;
  while ((match = regex.exec(source))) {
    const item = { start: match.index, end: match.index + match[0].length };
    groups.forEach(function (key, index) { item[key] = decode(match[index + 1]); });
    output.push(item);
  }
  return output;
}
function capturesRenderedText(source, regex, groups) {
  const output = [];
  let match;
  regex.lastIndex = 0;
  while ((match = regex.exec(source))) {
    const prefix = decode(source.slice(0, match.index).replace(/<[^>]*>/g, ''));
    const item = { start: prefix.length, end: prefix.length + decode(match[2]).length };
    groups.forEach(function (key, index) { item[key] = decode(match[index + 1]); });
    output.push(item);
  }
  return output;
}
function flattenStrings(value, output) {
  if (typeof value === 'string') output.push(value);
  else if (Array.isArray(value)) value.forEach(function (x) { flattenStrings(x, output); });
  else if (value && typeof value === 'object') Object.keys(value).forEach(function (key) { flattenStrings(value[key], output); });
}
function tokensIn(values) {
  const output = new Set();
  values.forEach(function (value) {
    (String(value || '').match(/[A-Za-zÄÖÜäöüßẞ]+(?:[-‐‑][A-Za-zÄÖÜäöüßẞ]+)*(?:['’][A-Za-zÄÖÜäöüßẞ]+)*/g) || []).forEach(function (token) {
      const norm = token.toLocaleLowerCase('de-DE');
      if (!['sich', 'mich', 'dich', 'uns', 'euch', 'der', 'die', 'das', 'den', 'dem', 'des', 'ein', 'eine', 'einem', 'einen', 'einer', 'eines', 'zu', 'um', 'an', 'auf', 'ab', 'aus', 'ein', 'mit', 'nach', 'vor', 'weg', 'teil'].includes(norm)) output.add(norm);
    });
  });
  return output;
}
function getDirectTerms(entry) {
  return sandbox.window.__exampleLatestTerms(entry);
}
function targetRecord(entry) {
  const grammar = entry.grammar || {};
  const candidate = entry.candidate_grammar || {};
  const noun = entry.noun || {};
  const terms = getDirectTerms(entry);
  const nounForms = (noun.plurals || []).concat(grammar.plural || []);
  nounForms.slice().forEach(function (form) { if (form && !/[ns]$/i.test(String(form))) nounForms.push(String(form) + 'n'); });
  const articles = noun.articles || grammar.article || [];
  const lemma = String(entry.lemma || entry.display_form || '');
  if (/e$/i.test(lemma)) nounForms.push(lemma + 'n');
  if (/es$/i.test(lemma) && /\bdas\b/i.test(String(grammar.usage || ''))) nounForms.push(lemma.slice(0, -1));
  if ((articles.includes('der') || articles.includes('das')) && !/e$/i.test(lemma)) {
    nounForms.push(lemma + 's');
    if (/[tdsxzßm]$/i.test(lemma) || (lemma.match(/[aeiouäöü]/gi) || []).length <= 1) nounForms.push(lemma + 'es');
  }
  const exampleTokens = [];
  (entry.examples || []).forEach(function (example) {
    (String(example.german || '').match(/[A-Za-zÄÖÜäöüßẞ]+(?:[-‐‑][A-Za-zÄÖÜäöüßẞ]+)*(?:['’][A-Za-zÄÖÜäöüßẞ]+)*/g) || []).forEach(function (token) {
      const key = token.toLocaleLowerCase('de-DE'), base = lemma.toLocaleLowerCase('de-DE');
      if (base.length > 4 && (key.startsWith(base) || key.endsWith(base))) nounForms.push(token);
      const umlauted = base.replace(/au/g, '@@').replace(/a/g, 'ä').replace(/o/g, 'ö').replace(/u/g, 'ü').replace(/@@/g, 'äu');
      if (umlauted !== base && key.startsWith(umlauted) && /(?:chen|lein)$/.test(key)) nounForms.push(token);
    });
  });
  const perfectTails = [];
  [grammar.perfect, candidate.perfect].forEach(function (value) { flattenStrings(value, perfectTails); });
  const participles = [];
  [grammar.participle, candidate.participle].forEach(function (value) { flattenStrings(value, participles); });
  perfectTails.forEach(function (value) { const words = String(value).match(/[A-Za-zÄÖÜäöüßẞ]+(?:[-‐‑][A-Za-zÄÖÜäöüßẞ]+)*(?:['’][A-Za-zÄÖÜäöüßẞ]+)*/g) || []; if (words.length > 1) participles.push(words[words.length - 1]); });
  return {
    id: entry.entry_id,
    lemma: entry.lemma,
    display_form: entry.display_form,
    part_of_speech: entry.word_class,
    meaning: entry.english_meaning,
    english_terms: terms.map(function (term) { return { term: term }; }),
    article: (noun.articles || []).join(' / '),
    articles: noun.articles || [],
    plural_forms: Array.from(new Set(nounForms)),
    forms: Object.assign({}, grammar.present || {}, candidate.present || {}),
    preterite: candidate.preterite || grammar.preterite || '',
    participle: participles
  };
}
function englishContextKind(text, start, end) {
  const before = String(text || '').slice(0, start).toLocaleLowerCase('en-US').match(/[a-z]+(?:'[a-z]+)?\s*$/);
  const after = String(text || '').slice(end).toLocaleLowerCase('en-US').match(/^\s*[a-z]+(?:'[a-z]+)?/);
  const previous = before ? before[0].trim().replace(/[^a-z']+$/, '').split(/\s+/).pop() : '';
  const next = after ? after[0].trim().split(/\s+/)[0] : '';
  const surface = String(text || '').slice(start, end).toLocaleLowerCase('en-US');
  const previousWords = String(text || '').slice(0, start).toLocaleLowerCase('en-US').match(/[a-z]+(?:'[a-z]+)?/g) || [];
  if (['itself','themselves','himself','herself','ourselves','yourself','yourselves'].includes(next)) return 'noun';
  if (['the','a','an','this','that','these','those','my','your','his','her','its','our','their'].includes(previous)) return 'noun';
  let determinerIndex = -1;
  for (let i = previousWords.length - 1; i >= Math.max(0, previousWords.length - 4); i--) {
    if (['the','a','an','this','that','these','those','my','your','his','her','its','our','their'].includes(previousWords[i])) { determinerIndex = i; break; }
  }
  if (determinerIndex >= 0 && previousWords.length - determinerIndex - 1 <= 3) return 'noun';
  if (['in','on','at','with','without','of','for','from','by','about','under','over','after','before','against','between','through','during','as'].includes(previous)) return 'noun';
  if (['can','could','may','might','must','shall','should','will','would'].includes(surface) || ['have to','has to','had to','be able to','am able to','is able to','are able to','was able to','were able to','been able to'].includes(surface)) return 'modal';
  if (previous === 'to') return 'verb';
  if (['can','could','may','might','must','shall','should','will','would','do','does','did',"don't","doesn't","didn't"].includes(previous)) return 'verb';
  if (['is','are','was','were','be','been','being'].includes(previous) && surface.endsWith('ing')) return 'verb';
  if (['i','you','he','she','it','we','they'].includes(previous)) return 'verb';
  return '';
}
function candidateMappedToOtherSource(candidate, expectedKind, german, english, translation) {
  const marks = english.filter(function (mark) { return mark.start === candidate.start && mark.end === candidate.end; });
  return marks.some(function (mark) {
    if (mark.kind === expectedKind) return true;
    return german.some(function (source) {
      if (source.kind !== mark.kind) return false;
      const record = { kind: source.kind, lemma: source.token, englishTerms: String(source.meaning || '').split(/\s*(?:;|·|\|)\s*/).filter(Boolean) };
      return sandbox.window.__exampleEnglishTerms(record).some(function (term) {
        return sandbox.window.__exampleFindEnglishMatches(translation, term, source.kind, 0).some(function (match) { return match.start === candidate.start && match.end === candidate.end; });
      });
    });
  });
}

const modals = new Set(['können', 'müssen', 'dürfen', 'sollen', 'wollen', 'mögen', 'möchten']);
const expectedKind = function (entry) {
  if (entry.word_class === 'noun') return 'noun';
  if (entry.word_class === 'verb') return modals.has(String(entry.lemma).toLocaleLowerCase('de-DE')) ? 'modal' : 'verb';
  return '';
};
const germanButtonRegex = /<button type="button" class="example-word vocab-(verb|noun|modal)"[^>]*>([\s\S]*?)<\/button><span class="example-meaning-popover"[^>]*>([\s\S]*?)<\/span>/g;
const germanInlineRegex = /<span class="example-word vocab-(verb|noun|modal)"[^>]*>([^<]*)<\/span>/g;
const englishRegex = /<span class="example-translation-mark vocab-(verb|noun|modal)">([^<]*)<\/span>/g;
const classes = { verb: 0, noun: 0, modal: 0 };
const targetMissingGerman = [];
const targetAbsentFromSentence = [];
const targetRoleExceptions = [];
const directEnglishMisses = [];
const noDirectEnglishTerm = [];
const crossClassAmbiguity = [];
const lexicalPrecisionChecks = [];
const germanCaseAnomalies = [];
const germanPronounNounMisclassifications = [];
const germanPersonalPronouns = new Set(['ich','du','er','sie','es','wir','ihr']);
const supplementalTargetMissingGerman = [];
const supplementalTargetAbsentFromSentence = [];
const kindsFor = new Map();
[...books.verbs.entries(), ...books.verbInflections.entries()].forEach(function (pair) {
  const key = pair[0], record = pair[1];
  if (!kindsFor.has(key)) kindsFor.set(key, new Set());
  kindsFor.get(key).add(record.kind);
});
books.nouns.forEach(function (_record, key) {
  if (!kindsFor.has(key)) kindsFor.set(key, new Set());
  kindsFor.get(key).add('noun');
});
books.modals.forEach(function (_record, key) {
  if (!kindsFor.has(key)) kindsFor.set(key, new Set());
  kindsFor.get(key).add('modal');
});
const crossClassKeys = Array.from(kindsFor.entries()).filter(function (pair) { return pair[1].size > 1; });
const totals = { entries: latest.entries.length, examples: 0, classes: { verb: 0, noun: 0, modal: 0, other: 0 }, highlights: 0, englishHighlights: 0, englishClasses: { verb: 0, noun: 0, modal: 0 }, targetHighlightedGerman: 0, targetMissingGerman: 0, targetAbsentFromSentence: 0, targetDirectEnglishMatchesInTranslation: 0, targetDirectEnglishMissingColor: 0, targetNoLiteralEnglishGlossInTranslation: 0, targetEnglishMatchesAlignedToOtherWords: 0, crossClassLexiconKeys: crossClassKeys.length, crossClassEnglishSpanExamples: 0 };

latest.entries.forEach(function (entry) {
  const kind = expectedKind(entry);
  const target = targetRecord(entry);
  const forms = [];
  forms.push(entry.lemma, entry.display_form);
  flattenStrings(entry.noun && entry.noun.plurals, forms);
  flattenStrings(target.plural_forms, forms);
  flattenStrings(entry.grammar && entry.grammar.present, forms);
  flattenStrings(entry.candidate_grammar && entry.candidate_grammar.present, forms);
  flattenStrings(entry.grammar && entry.grammar.preterite, forms);
  flattenStrings(entry.candidate_grammar && entry.candidate_grammar.preterite, forms);
  flattenStrings(entry.grammar && entry.grammar.participle, forms);
  flattenStrings(entry.candidate_grammar && entry.candidate_grammar.participle, forms);
  const targetTokens = tokensIn(forms);
  (entry.examples || []).forEach(function (example, exampleIndex) {
    totals.examples++;
    if (!kind) totals.classes.other++;
    else totals.classes[kind]++;
    const rendered = renderExampleSentence(example.german, example.english, target);
    const german = captures(rendered, germanButtonRegex, ['kind', 'token', 'meaning']).concat(captures(rendered, germanInlineRegex, ['kind', 'token']));
    const englishHTML = (rendered.match(/<div class="example-translation" lang="en">([\s\S]*?)<\/div>/) || [null, ''])[1];
    const english = capturesRenderedText(englishHTML, englishRegex, ['kind', 'text']);
    english.forEach(function (item) { totals.englishHighlights++; totals.englishClasses[item.kind]++; });
    german.forEach(function (mark) {
      const sourceIndex = example.german.toLocaleLowerCase('de-DE').indexOf(mark.token.toLocaleLowerCase('de-DE'));
      const before = sourceIndex >= 0 ? example.german.slice(0, sourceIndex) : '';
      const clauseStart = !before.trim() || /[.!?;:–—-]\s*["'„“»)]*$/.test(before);
      const capitalized = /^[A-ZÄÖÜ]/.test(mark.token);
      const mismatch = mark.kind === 'noun' ? !capitalized : ['verb','modal'].includes(mark.kind) && capitalized && !clauseStart;
      if (mismatch && germanCaseAnomalies.length < 30) germanCaseAnomalies.push({ id: entry.entry_id, lemma: entry.lemma, token: mark.token, kind: mark.kind, sentence: example.german });
      const tokenIndex = example.german.toLocaleLowerCase('de-DE').indexOf(mark.token.toLocaleLowerCase('de-DE'));
      if (mark.kind === 'noun' && germanPersonalPronouns.has(mark.token.toLocaleLowerCase('de-DE')) && !sandbox.window.__exampleHasGermanDeterminerBefore(example.german, tokenIndex) && germanPronounNounMisclassifications.length < 30) germanPronounNounMisclassifications.push({ id: entry.entry_id, token: mark.token, sentence: example.german });
    });
    if (entry.entry_id === 'frequency:463') {
      const give = english.some(function (mark) { return mark.kind === 'verb' && mark.text.toLocaleLowerCase('en-US') === 'give'; });
      const name = english.some(function (mark) { return mark.kind === 'noun' && mark.text.toLocaleLowerCase('en-US') === 'name'; });
      if (!give || !name) throw new Error('nennen precision check failed: expected green give and noun-colored name');
      lexicalPrecisionChecks.push({ id: entry.entry_id, green: 'give', noun: 'name' });
    }
    if (entry.entry_id === 'frequency:1731') {
      const phrasalVerb = english.some(function (mark) { return mark.kind === 'verb' && mark.text.toLocaleLowerCase('en-US') === 'set up'; });
      const companyNoun = english.some(function (mark) { return mark.kind === 'noun' && mark.text.toLocaleLowerCase('en-US') === 'company'; });
      const falseVerb = english.some(function (mark) { return mark.kind === 'verb' && mark.text.toLocaleLowerCase('en-US') === 'company'; });
      if (!phrasalVerb || !companyNoun || falseVerb) throw new Error('gründen precision check failed: expected green set up and noun-colored company');
      lexicalPrecisionChecks.push({ id: entry.entry_id, green: 'set up', noun: 'company', companyMistypedAsVerb: false });
    }
    if (entry.entry_id === 'frequency:951') {
      const doVerb = english.some(function (mark) { return mark.kind === 'verb' && mark.text.toLocaleLowerCase('en-US') === 'do'; });
      const workNoun = english.some(function (mark) { return mark.kind === 'noun' && mark.text.toLocaleLowerCase('en-US') === 'work'; });
      const sloppyMarked = english.some(function (mark) { return mark.text.toLocaleLowerCase('en-US') === 'sloppy'; });
      if (!doVerb || !workNoun || sloppyMarked) throw new Error('schlampen precision check failed: expected green do, noun-colored work, and no color on adjective sloppy');
      lexicalPrecisionChecks.push({ id: entry.entry_id, green: 'do', noun: 'work', adjectiveSloppyUncolored: !sloppyMarked });
    }
    if (entry.entry_id === 'frequency:1460') {
      const putOn = english.some(function (mark) { return mark.kind === 'verb' && mark.text.toLocaleLowerCase('en-US') === 'put on'; });
      const dressNoun = english.some(function (mark) { return mark.kind === 'noun' && mark.text.toLocaleLowerCase('en-US') === 'dress'; });
      const dressVerb = english.some(function (mark) { return mark.kind === 'verb' && mark.text.toLocaleLowerCase('en-US') === 'dress'; });
      if (!putOn || !dressNoun || dressVerb) throw new Error('antun precision check failed: expected green put on and noun-colored dress');
      lexicalPrecisionChecks.push({ id: entry.entry_id, green: 'put on', noun: 'dress', dressMistypedAsVerb: false });
    }
    if (entry.entry_id === 'curated:lex-de-gewohnheit') {
      const wayNoun = german.some(function (mark) { return mark.kind === 'noun' && mark.token.toLocaleLowerCase('de-DE') === 'weg'; });
      const wayVerb = german.some(function (mark) { return mark.kind === 'verb' && mark.token.toLocaleLowerCase('de-DE') === 'weg'; });
      if (!wayNoun || wayVerb) throw new Error('Weg noun precision check failed: article-governed Weg must not be treated as separable verb particle');
      lexicalPrecisionChecks.push({ id: entry.entry_id, noun: 'Weg', mistakenAsSeparableVerb: false });
    }
    if (entry.entry_id === 'curated:lexeme-de-c1-stellenwert') {
      const appearanceNoun = german.some(function (mark) { return mark.kind === 'noun' && mark.token.toLocaleLowerCase('de-DE') === 'aussehen'; });
      const appearanceVerb = german.some(function (mark) { return mark.kind === 'verb' && mark.token.toLocaleLowerCase('de-DE') === 'aussehen'; });
      if (!appearanceNoun || appearanceVerb) throw new Error('Aussehen noun precision check failed: nominalized Aussehen must not be treated as a verb');
      lexicalPrecisionChecks.push({ id: entry.entry_id, noun: 'Aussehen', meaning: 'appearance/looks' });
    }
    if (entry.entry_id === 'frequency:679') {
      const modal = english.some(function (mark) { return mark.kind === 'modal' && mark.text.toLocaleLowerCase('en-US') === 'want to'; });
      if (!modal) throw new Error('wollen precision check failed: expected modal-colored want to');
      lexicalPrecisionChecks.push({ id: entry.entry_id, modal: 'want to' });
    }
    if (entry.entry_id === 'frequency:541') {
      const klasse = german.some(function (mark) { return mark.kind === 'noun' && mark.token.toLocaleLowerCase('de-DE') === 'klasse'; });
      const grade = english.some(function (mark) { return mark.kind === 'noun' && mark.text.toLocaleLowerCase('en-US') === 'grade'; });
      if (!klasse || !grade) throw new Error('Klasse target alignment failed: expected noun-colored Klasse and grade');
      lexicalPrecisionChecks.push({ id: entry.entry_id, germanNoun: 'Klasse', englishNoun: 'grade' });
    }
    if (entry.entry_id === 'frequency:4368') {
      const command = german.some(function (mark) { return mark.kind === 'verb' && mark.token.toLocaleLowerCase('de-DE') === 'wegtreten'; });
      if (!command) throw new Error('Separable verb command failed: Wegtreten after a clause boundary must be verb-colored');
      lexicalPrecisionChecks.push({ id: entry.entry_id, germanVerb: 'Wegtreten' });
    }
    if (entry.entry_id === 'frequency:4126') {
      const falseNoun = german.some(function (mark) { return mark.kind === 'noun' && mark.token.toLocaleLowerCase('de-DE') === 'es'; });
      if (falseNoun) throw new Error('German pronoun precision failed: sentence-initial Es must not be colored as a noun');
      lexicalPrecisionChecks.push({ id: entry.entry_id, germanPronounUncolored: 'Es' });
    }
    german.forEach(function (item) { classes[item.kind]++; totals.highlights++; });
    const sentenceTokens = sandbox.window.__exampleSentenceTokens(example.german), targetRelatedTokens = new Set();
    sentenceTokens.forEach(function (token, tokenIndex) {
      const compound = sandbox.window.__exampleCompoundRecordAt(books, sentenceTokens, tokenIndex, example.german);
      const record = compound || books.modals.get(token.key) || books.verbs.get(token.key) || books.verbInflections.get(token.key) || books.nouns.get(token.key);
      if (record && String(record.lemma || '').toLocaleLowerCase('de-DE') === String(entry.lemma || '').toLocaleLowerCase('de-DE')) targetRelatedTokens.add(token.key);
    });
    const targetInSentence = sentenceTokens.some(function (token) { return targetTokens.has(token.key) || targetRelatedTokens.has(token.key); });
    const targetMarked = kind && german.some(function (item) {
      const key = item.token.toLocaleLowerCase('de-DE');
      return item.kind === kind && (targetTokens.has(key) || targetRelatedTokens.has(key));
    });
    if (kind && !targetInSentence) {
      totals.targetAbsentFromSentence++;
      targetAbsentFromSentence.push({ id: entry.entry_id, lemma: entry.lemma, kind: kind, wordClass: entry.word_class, example: example.german, translation: example.english, highlighted: german.map(function (x) { return x.token + ':' + x.kind; }) });
    } else if (kind && targetInSentence && !targetMarked) {
      const usage=String(entry.grammar&&entry.grammar.usage||'');
      if(entry.entry_id==='frequency:1808'&&/used attributively here/i.test(usage))targetRoleExceptions.push({id:entry.entry_id,lemma:entry.lemma,example:example.german,reason:'Past participle used as an adjective; no verb color is appropriate.'});
      else{
        totals.targetMissingGerman++;
        targetMissingGerman.push({ id: entry.entry_id, lemma: entry.lemma, kind: kind, example: example.german, translation: example.english, highlighted: german.map(function (x) { return x.token + ':' + x.kind; }) });
      }
    } else if (kind && targetMarked) totals.targetHighlightedGerman++;

    if (!kind || !targetMarked) return;
    const terms = getDirectTerms(entry);
    const auditRecord = { kind: kind, lemma: entry.lemma, englishTerms: terms.map(function (term) { return { term: term }; }) };
    const auditTerms = sandbox.window.__exampleEnglishTerms(auditRecord);
    let directMatches = [];
    auditTerms.forEach(function (term) {
      const candidates = sandbox.window.__exampleFindEnglishMatches(example.english, term.replace(/^(?:to|the|a|an)\s+/i, ''), kind, 0);
      directMatches = directMatches.concat(candidates);
    });
    directMatches = directMatches.filter(function (candidate, index, array) {
      return array.findIndex(function (other) { return other.start === candidate.start && other.end === candidate.end; }) === index;
    });
    if (directMatches.length) {
      totals.targetDirectEnglishMatchesInTranslation++;
      const unresolved = directMatches.filter(function (candidate) {
        const sameKindMark = english.some(function (item) { return item.kind === kind && item.start <= candidate.start && item.end >= candidate.end; });
        return !sameKindMark && !candidateMappedToOtherSource(candidate, kind, german, english, example.english);
      });
      if (unresolved.length) {
        totals.targetDirectEnglishMissingColor++;
        directEnglishMisses.push({ id: entry.entry_id, lemma: entry.lemma, kind: kind, example: example.german, translation: example.english, directMatches: unresolved.map(function (x) { return example.english.slice(x.start, x.end); }), germanHighlighted: german.map(function (x) { return x.token + ':' + x.kind + ':' + x.meaning; }), highlighted: english.map(function (x) { return x.text + ':' + x.kind; }) });
      }
      if (!unresolved.length && !directMatches.some(function (candidate) { return english.some(function (item) { return item.kind === kind && item.start <= candidate.start && item.end >= candidate.end; }); })) totals.targetEnglishMatchesAlignedToOtherWords++;
    } else if (kind) {
      totals.targetNoLiteralEnglishGlossInTranslation++;
      if (noDirectEnglishTerm.length < 80) noDirectEnglishTerm.push({ id: entry.entry_id, lemma: entry.lemma, kind: kind, example: example.german, translation: example.english, terms: terms });
    }

    const englishConflicts = [];
    english.forEach(function (mark) {
      const owners = german.filter(function (source) {
        const record = { kind: source.kind, lemma: source.token, meaning: source.meaning, englishTerms: String(source.meaning || '').split(/\s*(?:;|·|\|)\s*/).filter(Boolean) };
        const candidates = record.englishTerms.flatMap(function (term) {
          return sandbox.window.__exampleFindEnglishMatches(example.english, term.replace(/^(?:to|the|a|an)\s+/i, ''), record.kind, 0);
        });
        return candidates.some(function (candidate) { return candidate.start === mark.start && candidate.end === mark.end; });
      });
      const ownerKinds = Array.from(new Set(owners.map(function (x) { return x.kind; })));
      const contextKind = englishContextKind(example.english, mark.start, mark.end);
      if (ownerKinds.length > 1 && contextKind !== mark.kind) englishConflicts.push({ text: mark.text, actualKind: mark.kind, contextKind: contextKind, kinds: ownerKinds, german: owners.map(function (x) { return x.token; }) });
    });
    if (englishConflicts.length) {
      totals.crossClassEnglishSpanExamples++;
      if (crossClassAmbiguity.length < 120) crossClassAmbiguity.push({ id: entry.entry_id, lemma: entry.lemma, example: example.german, translation: example.english, conflicts: englishConflicts });
    }
  });
});
const supplementalTotals = {
  sources: {
    general: { entries: 0, examples: 0, noEnglishTranslation: 0, germanHighlights: 0, englishHighlights: 0, targetHighlightedGerman: 0, targetMissingGerman: 0, targetAbsentFromSentence: 0, directEnglishMatches: 0, directEnglishMissingColor: 0, crossClassEnglishSpanExamples: 0 },
    course: { entries: 0, examples: 0, noEnglishTranslation: 0, germanHighlights: 0, englishHighlights: 0, targetHighlightedGerman: 0, targetMissingGerman: 0, targetAbsentFromSentence: 0, directEnglishMatches: 0, directEnglishMissingColor: 0, crossClassEnglishSpanExamples: 0 }
  },
  directEnglishMisses: [],
  crossClassAmbiguities: [],
  lexicalPrecisionChecks: []
};
function auditSupplementalSource(sourceName, entries, examplesFor, targetFor, kindFor) {
  const sourceStats = supplementalTotals.sources[sourceName];
  entries.forEach(function (row) {
    const examples = examplesFor(row) || [];
    if (!examples.length) return;
    sourceStats.entries++;
    const target = targetFor(row), kind = kindFor(row), lemma = row.lemma || row.id || '';
    examples.forEach(function (example, exampleIndex) {
      const germanText = Array.isArray(example) ? example[0] : example.sentence || example.german || example.de || '';
      const englishText = Array.isArray(example) ? example[1] : example.translation || example.english || '';
      sourceStats.examples++;
      if (!englishText) sourceStats.noEnglishTranslation++;
      const rendered = renderExampleSentence(germanText, englishText, target);
      const german = captures(rendered, germanButtonRegex, ['kind', 'token', 'meaning']).concat(captures(rendered, germanInlineRegex, ['kind', 'token']));
      const englishHTML = (rendered.match(/<div class="example-translation" lang="en">([\s\S]*?)<\/div>/) || [null, ''])[1];
      const english = capturesRenderedText(englishHTML, englishRegex, ['kind', 'text']);
      sourceStats.germanHighlights += german.length;
      sourceStats.englishHighlights += english.length;
      if (kind) {
        const lemmaKey = String(target.lemma || target.id || target.word || '').toLocaleLowerCase('de-DE');
        const targetForms = [];
        [target.lemma,target.display_form,target.lemma?null:target.id,target.word,target.plural_forms,target.forms,target.preterite,target.participle].forEach(function (value) { flattenStrings(value, targetForms); });
        const targetSurfaceKeys = tokensIn(targetForms);
        const sentenceTokens = sandbox.window.__exampleSentenceTokens(germanText), relatedKeys = new Set();
        sentenceTokens.forEach(function (token, tokenIndex) {
          if (targetSurfaceKeys.has(token.key)) relatedKeys.add(token.key);
          const compound = sandbox.window.__exampleCompoundRecordAt(books, sentenceTokens, tokenIndex, germanText);
          const record = compound || books.modals.get(token.key) || books.verbs.get(token.key) || books.verbInflections.get(token.key) || books.nouns.get(token.key);
          if (record && String(record.lemma || '').toLocaleLowerCase('de-DE') === lemmaKey) relatedKeys.add(token.key);
        });
        const targetInSentence = relatedKeys.size > 0;
        const targetMarked = targetInSentence && german.some(function (mark) { return mark.kind === kind && relatedKeys.has(mark.token.toLocaleLowerCase('de-DE')); });
        if (!targetInSentence) {
          sourceStats.targetAbsentFromSentence++;
          if (supplementalTargetAbsentFromSentence.length < 80) supplementalTargetAbsentFromSentence.push({ source: sourceName, id: row.id || row.entry_id, lemma: lemma, kind: kind, sentence: germanText, translation: englishText });
        } else if (!targetMarked) {
          sourceStats.targetMissingGerman++;
          if (supplementalTargetMissingGerman.length < 80) supplementalTargetMissingGerman.push({ source: sourceName, id: row.id || row.entry_id, lemma: lemma, kind: kind, sentence: germanText, translation: englishText, highlighted: german.map(function (mark) { return mark.token + ':' + mark.kind; }) });
        } else sourceStats.targetHighlightedGerman++;
      }
      if (sourceName === 'general' && row.id === 'lex-de-notwendigkeit') {
        const nounMuss = german.some(function (mark) { return mark.kind === 'noun' && mark.token.toLocaleLowerCase('de-DE') === 'muss'; });
        const modalMuss = german.some(function (mark) { return mark.kind === 'modal' && mark.token.toLocaleLowerCase('de-DE') === 'muss'; });
        if (!nounMuss || modalMuss) throw new Error('Muss noun precision check failed: expected noun-colored German Muss; actual=' + JSON.stringify(german.map(function (mark) { return mark.token + ':' + mark.kind; })));
        supplementalTotals.lexicalPrecisionChecks.push({ source: sourceName, id: row.id, germanNoun: 'Muss' });
      }
      if (sourceName === 'general' && row.id === 'lex-de-platz-seat') {
        const platz = german.some(function (mark) { return mark.kind === 'noun' && mark.token.toLocaleLowerCase('de-DE') === 'platz'; });
        const seat = english.some(function (mark) { return mark.kind === 'noun' && mark.text.toLocaleLowerCase('en-US') === 'seat'; });
        if (!platz || !seat) throw new Error('Platz target alignment failed: expected noun-colored Platz and seat');
        supplementalTotals.lexicalPrecisionChecks.push({ source: sourceName, id: row.id, germanNoun: 'Platz', englishNoun: 'seat' });
      }
      german.forEach(function (mark) {
        const sourceIndex = germanText.toLocaleLowerCase('de-DE').indexOf(mark.token.toLocaleLowerCase('de-DE'));
        const before = sourceIndex >= 0 ? germanText.slice(0, sourceIndex) : '';
        const clauseStart = !before.trim() || /[.!?;:–—-]\s*["'„“»)]*$/.test(before);
        const capitalized = /^[A-ZÄÖÜ]/.test(mark.token);
        const mismatch = mark.kind === 'noun' ? !capitalized : ['verb','modal'].includes(mark.kind) && capitalized && !clauseStart;
        if (mismatch && germanCaseAnomalies.length < 30) germanCaseAnomalies.push({ source: sourceName, id: row.id || row.entry_id, lemma: lemma, token: mark.token, kind: mark.kind, sentence: germanText });
        const tokenIndex = germanText.toLocaleLowerCase('de-DE').indexOf(mark.token.toLocaleLowerCase('de-DE'));
        if (mark.kind === 'noun' && germanPersonalPronouns.has(mark.token.toLocaleLowerCase('de-DE')) && !sandbox.window.__exampleHasGermanDeterminerBefore(germanText, tokenIndex) && germanPronounNounMisclassifications.length < 30) germanPronounNounMisclassifications.push({ source: sourceName, id: row.id || row.entry_id, token: mark.token, sentence: germanText });
      });
      if (!englishText) return;
      const termRecord = {
        kind: kind || '',
        lemma: lemma,
        meaning: row.meaning || row.english_meaning || '',
        englishTerms: row.english_terms || (row.meaning ? [{ term: row.meaning }] : [])
      };
      const auditTerms = sandbox.window.__exampleEnglishTerms(termRecord);
      let directMatches = [];
      auditTerms.forEach(function (term) { directMatches = directMatches.concat(sandbox.window.__exampleFindEnglishMatches(englishText, term, kind || 'verb', 0)); });
      directMatches = directMatches.filter(function (candidate, index, array) { return array.findIndex(function (other) { return other.start === candidate.start && other.end === candidate.end; }) === index; });
      if (directMatches.length && kind) {
        sourceStats.directEnglishMatches++;
        const unresolved = directMatches.filter(function (candidate) {
          const sameKindMark = english.some(function (mark) { return mark.kind === kind && mark.start <= candidate.start && mark.end >= candidate.end; });
          return !sameKindMark && !candidateMappedToOtherSource(candidate, kind, german, english, englishText);
        });
        if (unresolved.length) {
          sourceStats.directEnglishMissingColor++;
          if (supplementalTotals.directEnglishMisses.length < 60) supplementalTotals.directEnglishMisses.push({ source: sourceName, id: row.id || row.entry_id, lemma: lemma, kind: kind, sentence: germanText, translation: englishText, missing: unresolved.map(function (match) { return englishText.slice(match.start, match.end); }), highlighted: english.map(function (mark) { return mark.text + ':' + mark.kind; }) });
        }
      }
      const conflicts = [];
      english.forEach(function (mark) {
        const owners = german.filter(function (source) {
          const record = { kind: source.kind, lemma: source.token, meaning: source.meaning, englishTerms: String(source.meaning || '').split(/\s*(?:;|·|\|)\s*/).filter(Boolean) };
          return sandbox.window.__exampleEnglishTerms(record).some(function (term) { return sandbox.window.__exampleFindEnglishMatches(englishText, term, record.kind, 0).some(function (candidate) { return candidate.start === mark.start && candidate.end === mark.end; }); });
        });
        const ownerKinds = Array.from(new Set(owners.map(function (owner) { return owner.kind; })));
        const hint = englishContextKind(englishText, mark.start, mark.end);
        if (ownerKinds.length > 1 && hint !== mark.kind) conflicts.push({ text: mark.text, actualKind: mark.kind, contextKind: hint, kinds: ownerKinds, german: owners.map(function (owner) { return owner.token; }) });
      });
      if (conflicts.length) {
        sourceStats.crossClassEnglishSpanExamples++;
        if (supplementalTotals.crossClassAmbiguities.length < 60) supplementalTotals.crossClassAmbiguities.push({ source: sourceName, id: row.id || row.entry_id, exampleIndex: exampleIndex, sentence: germanText, translation: englishText, conflicts: conflicts });
      }
    });
  });
}
auditSupplementalSource('general', general.entries || [], function (row) { return row.german_examples || row.examples || []; }, function (row) { return row; }, function (row) {
  const pos = row.part_of_speech || '';
  if (pos === 'noun') return 'noun';
  if (pos === 'verb') return modals.has(String(row.lemma || '').toLocaleLowerCase('de-DE')) ? 'modal' : 'verb';
  return '';
});
auditSupplementalSource('course', courseVerbs, function (row) { return row.examples || []; }, function (row) { return Object.assign({}, row, { part_of_speech: 'verb', english_terms: [{ term: row.meaning || '' }] }); }, function () { return 'verb'; });
const uniqueExamplePairs = new Set();
latest.entries.forEach(function (row) { (row.examples || []).forEach(function (example) { uniqueExamplePairs.add(String(example.german || '').trim() + '\u0000' + String(example.english || '').trim()); }); });
(general.entries || []).forEach(function (row) { (row.german_examples || row.examples || []).forEach(function (example) { uniqueExamplePairs.add(String(example.sentence || example.german || '').trim() + '\u0000' + String(example.translation || example.english || '').trim()); }); });
courseVerbs.forEach(function (row) { (row.examples || []).forEach(function (example) { uniqueExamplePairs.add(String(Array.isArray(example) ? example[0] : example.german || '').trim() + '\u0000' + String(Array.isArray(example) ? example[1] : example.english || '').trim()); }); });
const summary = {
  metadata: latest.metadata,
  coverage: {
    latestDatabaseExamples: totals.examples,
    generalAndCourseExamples: supplementalTotals.sources.general.examples + supplementalTotals.sources.course.examples,
    allSourceExampleInstances: totals.examples + supplementalTotals.sources.general.examples + supplementalTotals.sources.course.examples,
    distinctGermanEnglishPairs: uniqueExamplePairs.size,
    totalGermanHighlights: totals.highlights + supplementalTotals.sources.general.germanHighlights + supplementalTotals.sources.course.germanHighlights,
    totalEnglishHighlights: totals.englishHighlights + supplementalTotals.sources.general.englishHighlights + supplementalTotals.sources.course.englishHighlights
  },
  totals: totals,
  supplemental: supplementalTotals,
  dictionary: {
    verbs: books.verbs.size,
    verbInflections: books.verbInflections.size,
    nouns: books.nouns.size,
    modals: books.modals.size,
    crossClassLexiconKeyCount: crossClassKeys.length
  },
  morphologyChecks: morphologyCases,
  glossaryParserChecks: glossaryCases,
  lexicalPrecisionChecks: lexicalPrecisionChecks,
  germanCaseAnomalies: germanCaseAnomalies,
  germanPronounNounMisclassifications: germanPronounNounMisclassifications,
  targetMissingGerman: targetMissingGerman.slice(0, 120),
  targetRoleExceptions: targetRoleExceptions,
  targetAbsentFromSentence: targetAbsentFromSentence.slice(0, 120),
  supplementalTargetMissingGerman: supplementalTargetMissingGerman,
  supplementalTargetAbsentFromSentence: supplementalTargetAbsentFromSentence,
  directEnglishMisses: directEnglishMisses.slice(0, 120),
  noDirectEnglishTermSample: noDirectEnglishTerm.slice(0, 80),
  crossClassAmbiguity: crossClassAmbiguity.slice(0, 10)
};
console.log(JSON.stringify(summary, null, 2));
