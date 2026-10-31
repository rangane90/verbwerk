# Verbwerk

A static, offline-capable German vocabulary trainer published with GitHub Pages at https://rangane90.github.io/verbwerk/.

## App

- Home, Practice and Library sections.
- Existing daily verb lessons, review, article practice, pronunciation, progress, and backup import/export.
- General German vocabulary library and separate practice across A1-C2, with 705 active entries from a pinned, permissively licensed source snapshot.
- The 50-entry Wikidata Lexeme pilot remains available as a separate library.
- The existing learner progress key remains verbwerk_local_v1; general vocabulary progress is stored separately.

## Vocabulary data

The general A1-C2 runtime is derived from the Lexicon Platform source revision e45c6d558898b31214a15fda907189c3c43bc511. The deployed app bundles the compact runtime for offline use. Full source-pack files, the combined source dataset, and reproducible builders remain in the separate v8 development copy. This is a curated source snapshot, not an exhaustive German dictionary or an official CEFR vocabulary list.

Lexicon Platform lexical data by Massimo Mazzariol and contributors is licensed under CC BY 4.0. See VOCABULARY-LICENSE.md for attribution and license details.

## Offline behavior

The service worker bundles the app shell and vocabulary runtime. Its cache cleanup is scoped to the v8 cache namespace and preserves the earlier v7 cache. A service-worker simulation passed; offline behavior has not yet been confirmed in a real browser.

## Release

The v8 app is published from the repository root on the main branch. The separate stable v7 folder was not modified.
