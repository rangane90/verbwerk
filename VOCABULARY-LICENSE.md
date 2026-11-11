# Vocabulary source and license notes

## Source

The 50-entry starter snapshot is linked to German Lexemes in Wikidata (language Q188). Each record in vocabulary-pilot.js includes its Wikidata Lexeme ID and source URI. The retrieved structured lexical records include lemma, lexical category, and available English glosses; noun gender and plural forms are included where Wikidata provides them. The five multiword expressions from the provisional pilot were replaced with the Wikidata-sourced beginner adverbs heute, morgen, immer, hier, and bald.

Wikidata states that structured data, including the Lexeme namespace, is released under CC0 1.0. Attribution is not required, but Wikidata recommends naming it as the data origin:
- Licensing policy: https://www.wikidata.org/wiki/Wikidata:Licensing
- Data access and attribution guidance: https://www.wikidata.org/wiki/Wikidata:Data_access/en
- Lexeme data model: https://www.wikidata.org/wiki/Wikidata:Lexicographical_data/Documentation

Snapshot retrieved 2026-10-31. The app bundles this snapshot for offline use and does not call Wikidata at runtime.

## Field boundaries

CC0 applies to the embedded Wikidata Lexeme records and fields marked in each entry's wikidata object. Existing Verbwerk meanings, CEFR labels, verb practice links, examples, case notes, and app code were retained from the v7 project and are not relicensed by this file. Where Wikidata provides English glosses, they are preserved in wikidata.englishGlosses; the learner-facing meaning remains the existing Verbwerk gloss except for the five new adverbs.

For nouns, wikidata.gender, wikidata.pluralForms, wikidata.articleVerified, and wikidata.pluralVerified record whether the existing article and plural agree with available Wikidata data. These checks validate source matching and record consistency, not a full independent dictionary review.

## General German vocabulary corpus (A1-C2)

A separate general corpus was added under data/vocabulary/general-a1-c2/ on 2026-10-31. It snapshots all six German vocabulary packs and six expression packs from the Lexicon Platform at revision e45c6d558898b31214a15fda907189c3c43bc511 (source pack versions 1.0.99 through 1.0.10; pack data generated 2026-10-19).

The upstream content is licensed CC BY 4.0. Preferred attribution: "Lexicon Platform lexical data by Massimo Mazzariol and contributors, licensed under CC BY 4.0. Modified for Verbwerk." Source repository: https://github.com/massimomazzariol/Lexicon. License text: https://creativecommons.org/licenses/by/4.0/. The separate V11 development copy retains the original source-pack files, the combined vocabulary.json, and upstream notices under data/vocabulary/general-a1-c2/. The live site bundles the compact derived runtime and this attribution record; it does not load the source packs at run time. The complete source is available at the pinned Lexicon Platform revision linked above. The dataset's CC BY 4.0 terms apply to that lexical content; they do not relicense Verbwerk code or the separate Wikidata pilot.

Coverage at the pinned revision: 664 concepts, including 61 expressions; 710 German lexeme entries; German and English definitions for all concepts; gender for all 224 nouns; source plural forms for 204 of those nouns; 705 approved and 5 deprecated German lexeme entries. Missing plural forms are left empty. CEFR is not a universal exhaustive German word list; these level assignments belong to the named source. The compact derived runtime is bundled for offline use and shown in the General A1-C2 Library and separate practice track. The full, unmodified source pack records remain in data/vocabulary/general-a1-c2/source-packs/. The app filters out the five source records marked deprecated.

## Verbwerk vocabulary supplement

The app General Library also includes 24 entries absent from the pinned Lexicon Platform snapshot: 23 existing Verbwerk v7 entries matched to Wikidata German Lexemes, plus the adverb bald. Wikidata lexical facts are CC0 1.0; the new German definitions and example sentences in data/vocabulary/general-a1-c2/source-packs/verbwerk_wikidata_supplement_v1/ are Verbwerk learning content released under CC BY 4.0. Existing Verbwerk meanings and records retain their original project terms. Every added record carries its Wikidata Lexeme ID and source record where available.

## EverFlip German supplement

On 2026-11-01, 77 additional entries were added from the German cards in EverFlip Multilingual Flashcard Corpus version 1.0.0. The dataset author describes the factual card data as CC BY 4.0 and requests attribution to EverFlip: https://everflip.app/dataset. Attribution: “EverFlip (2026), EverFlip Multilingual Flashcard Corpus, version 1.0.0, CC BY 4.0. https://everflip.app/dataset”. The selected source cards and source deck metadata are preserved in data/vocabulary/general-a1-c2/source-packs/verbwerk_everflip_de_supplement_v1/.

The supplement was filtered to standalone German headwords missing from the 705-entry Lexicon core and the 24-entry Wikidata supplement. The downloaded mirror contained 451 German cards; these yielded 124 unique one-word candidates, of which 77 were absent. The EverFlip site currently describes the full corpus as 24,963 cards, while the downloaded mirror snapshot contained 24,164 rows; the source-count discrepancy is retained here rather than inferred away. Only the 77 selected card facts were used. Their English meanings were rewritten as learner glosses and Verbwerk added original German definitions, example sentences, translations, and relevant noun forms. This Verbwerk-authored learner text is released under CC BY 4.0. Source deck names and CEFR metadata are kept only as provenance and are not shown as Library filters or labels.

The combined General Library now has 806 approved active entries (705 Lexicon Platform, 24 Wikidata and 77 EverFlip). The runtime contains 811 records total because it retains five deprecated Lexicon records as inactive. The separate 50-word pilot remains available in the Library.

## Wordly German frequency index

The standalone offline asset vocabulary-wordly-de.js wraps the 5,000 rows from [Wordly’s German index](https://github.com/akashnairrr/wordly/blob/92a0eb6de3ef18d9b86f6e446f9d91eb0b9aad8a/public/data/de/index.json) by Akash Nair and contributors in a JavaScript assignment. Its IDs, lemmas, word classes, ranks, and short English glosses are unchanged. The index is distributed under [CC BY-SA 4.0](https://creativecommons.org/licenses/by-sa/4.0/), as stated in [Wordly’s data credits](https://github.com/akashnairrr/wordly/blob/92a0eb6de3ef18d9b86f6e446f9d91eb0b9aad8a/src/app/about/page.tsx). Retrieved on 2026-11-09.

Wordly credits Hermit Dave’s [FrequencyWords](https://github.com/hermitdave/FrequencyWords), using OpenSubtitles 2018, for the frequency input, and [Wiktionary contributors](https://en.wiktionary.org/) via [Kaikki Wiktextract](https://kaikki.org/) for meanings and dictionary forms. See the pinned Wordly credits for upstream notices. The imported index includes headwords, ranks, word classes, and short English glosses.

Verbwerk uses the index as a separate reference list and uses case-sensitive German lemma and word-class matches to prioritize its own curated entries. Shared lemmas can have different meanings. Ranks describe corpus frequency at the headword level. The curated corpus keeps its existing sources and terms.

## DWDS-checked vocabulary and grammar supplement

The 2022-07-28 [DWDS headword snapshot](https://clarin.bbaw.de/de/objects/dwds%3A2/) by Digitales Wörterbuch der deutschen Sprache (DWDS), BBAW, is CC BY-SA 4.0. The review pack uses selected headwords, DWDS record IDs, word classes and noun genders. The DWDS-derived data and adaptations are attributed and shared under [CC BY-SA 4.0](https://creativecommons.org/licenses/by-sa/4.0/). Verbwerk authored the definitions, English glosses, example sentences, translations and learner notes and releases that original text under CC BY 4.0. Duden and IDS grammis were consulted as editorial references. Record-level links are in the pack and its correction file. Reviewed 2026-11-10.

Spelling follows [Duden’s guidance on combinations of verbs](https://www.duden.de/sprachwissen/sprachratgeber/Getrennt-und-Zusammenschreibung). The course entry for [sich bewerben](https://www.duden.de/rechtschreibung/bewerben) follows the documented strong forms and prepositions. [IDS grammis](https://grammis.ids-mannheim.de/systematische-grammatik/1615) documents the modal Ersatzinfinitiv. The General Library now has 818 approved active entries and five inactive source records.

## DWDS and Duden review batch 2

The audit pack adds 26 entries and carries DWDS IDs and source word classes from the CC BY-SA 4.0 [DWDS headword snapshot](https://clarin.bbaw.de/de/objects/dwds%3A2/). Definitions, examples, translations and learner notes are original Verbwerk material under CC BY 4.0. Duden was used for editorial checks. Verbwerk teaches nicht as a negation particle following [Duden](https://www.duden.de/sprachwissen/fuer-lernende/wortarten-partikeln). The DWDS snapshot categorizes it as ADV. The curated library now has 844 active entries and five inactive source records.

Editorial checks covered the 15 previously blank noun plurals, all nine existing repeated-lemma groups, and selected gaps in clause order, prepositional cases, negation, personal pronoun cases and verb usage. The DWDS comparison established headword coverage. Sense and grammar agreement still require review of the individual entries.

## DWDS and Duden curation batch 3

This pack uses DWDS headword records under CC BY-SA 4.0 with record-level attribution. Inflected article forms die, das and eine link to their source headword family. Duden references are for checking grammar and usage. Verbwerk wrote the learning text and examples under CC BY 4.0. Duden references were used for editorial checks; the Grammar view presents explanations and self-checks inside Verbwerk without sending learners to external grammar pages. Earlier counts in this file describe their respective review batches. Current coverage is 891 active entries. The third pack includes all remaining literal headword gaps in Wordly’s top 100. Word-class and sense coverage are measured separately.


## German noun gender supplement

The offline asset `vocabulary-gender-index.js` maps all 2,533 noun rows in the bundled Wordly German frequency index to grammatical article options or an explicit usage note. Gender data was derived from the `german_nouns/nouns.csv` table in [gambolputty/german-nouns](https://github.com/gambolputty/german-nouns), compiled from German Wiktionary (WiktionaryDE). The source and adapted gender index are distributed under [CC BY-SA 4.0](https://creativecommons.org/licenses/by-sa/4.0/). Source file SHA-1: `b2bbf3c70a8a41d11581ce4e4ee2cc2425207c73`; SHA-256 and coverage counts are recorded in the generated asset metadata.

The mapping has 2,479 exact lemma matches, 17 plural-form matches, and 37 editorially reviewed exception records. Of those 37, 35 have an article and two are explicitly annotated as an inflected form or a fixed phrase without a standalone article. A total of 157 rows have more than one attested article; Verbwerk displays all listed options and excludes ambiguous options from single-answer article quizzes.

## Merged study database export

The versioned merged export includes adapted Wiktionary material supplied by [Kaikki / Wiktextract](https://kaikki.org/dictionary/German/) and the [German-edition extract](https://kaikki.org/dictionary/rawdata.html). Credit Wiktionary contributors under [CC BY-SA 4.0](https://creativecommons.org/licenses/by-sa/4.0/). The export also includes forms from [UniMorph German](https://github.com/unimorph/deu) under [CC BY-SA 3.0](https://creativecommons.org/licenses/by-sa/3.0/) and [german-nouns](https://github.com/gambolputty/german-nouns) under CC BY-SA 4.0. Editorial additions and source mappings adapt the data for Verbwerk.

Bilingual pairs from [Tatoeba via ManyThings](https://www.manythings.org/anki/) retain both contributor credits and sentence IDs under [CC BY 2.0 France](https://creativecommons.org/licenses/by/2.0/fr/). The app renders the credit with the example. Some candidate translations were produced locally using Argos Translate. Some grammar observations were generated using the [spaCy German pipeline](https://spacy.io/models/de#de_core_news_sm). The browser asset includes the database provenance and separates candidate material from reviewed fields.
