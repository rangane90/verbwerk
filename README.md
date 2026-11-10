# Verbwerk

A static, offline-capable German vocabulary trainer. This is the V10.1 release build, based on the V10 Wordly release.

**[Open the live app](https://rangane90.github.io/verbwerk/)** — launch the German vocabulary trainer.

## App

- Home, Practice and Library sections.
- Existing daily verb lessons, review, article practice, pronunciation, progress, and backup import/export.
- Persistent light/dark theme and regular or 0.7× German browser-voice playback.
- General German vocabulary library and separate practice across A1-C2, with 891 active entries: a 705-entry CC BY 4.0 source core, 24 Wikidata supplements, 77 EverFlip supplements and 85 DWDS-checked additions. The Wortschatz view opens at Alle Wörter and can be narrowed by word type. Konnektoren includes conjunctions and selected connecting adverbs. The separate Wordly reference also supports word-type filtering.
- The 50-entry Wikidata Lexeme pilot remains available as a separate library.
- The existing learner progress key remains verbwerk_local_v1; general vocabulary progress is stored separately.

The Library’s Grammatik view has short reference cards, original examples and optional self-checks for nine topics.

## Vocabulary data

The Library includes a separate offline Wordly reference of 5,000 German entries, searchable in German or English across five frequency bands. General vocabulary practice prioritizes missed entries, then unseen entries in Wordly rank order where the lemma and word class match. Existing learner progress and curated vocabulary IDs are retained.

The general A1-C2 runtime is derived from the Lexicon Platform source revision e45c6d558898b31214a15fda907189c3c43bc511. The deployed app bundles the compact runtime for offline use. Full source-pack files, the combined source dataset, and reproducible builders are retained in the development workspace and are not included in the static site deployment. This is a curated source snapshot, not an exhaustive German dictionary or an official CEFR vocabulary list.

Lexicon Platform data is CC BY 4.0; supplemental Wikidata lexical facts are CC0 1.0; and the selected EverFlip card facts and new Verbwerk learner text are CC BY 4.0. See VOCABULARY-LICENSE.md for attribution and source-selection details.

## Offline behavior

The service worker bundles the app shell and vocabulary runtime. Its cache cleanup retires prior v8, v9, v10, and v11 preview caches while preserving the earlier v7 cache. Requests read from the current V10.1 cache only. The cache key is verbwerk-v10-1-grammar-1. Isolated Chrome checks covered word-type filters, entry details, listening choices, grammar self-checks, a 320 px layout, and offline reload. Physical iPhone Safari gestures still need a device check.

## Release

The V10.1 build is published from main at https://rangane90.github.io/verbwerk/.
