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

The upstream content is licensed CC BY 4.0. Preferred attribution: "Lexicon Platform lexical data by Massimo Mazzariol and contributors, licensed under CC BY 4.0. Modified for Verbwerk." Source repository: https://github.com/massimomazzariol/Lexicon. License text: https://creativecommons.org/licenses/by/4.0/. The separate v8 development copy retains the original source-pack files, the combined vocabulary.json, and upstream notices under data/vocabulary/general-a1-c2/. The live site bundles the compact derived runtime and this attribution record; it does not load the source packs at run time. The complete source is available at the pinned Lexicon Platform revision linked above. The dataset's CC BY 4.0 terms apply to that lexical content; they do not relicense Verbwerk code or the separate Wikidata pilot.

Coverage at the pinned revision: 664 concepts, including 61 expressions; 710 German lexeme entries; German and English definitions for all concepts; gender for all 224 nouns; source plural forms for 204 of those nouns; 705 approved and 5 deprecated German lexeme entries. Missing plural forms are left empty. CEFR is not a universal exhaustive German word list; these level assignments belong to the named source. The compact derived runtime is bundled for offline use and shown in the General A1-C2 Library and separate practice track. The full, unmodified source pack records remain in data/vocabulary/general-a1-c2/source-packs/. The app filters out the five source records marked deprecated.

