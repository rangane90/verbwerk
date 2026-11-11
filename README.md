# Verbwerk

A static, offline-capable German vocabulary trainer. Version 11 was QA-checked locally and released from the main branch on 2026-11-10. The stable V7 rollback copy remains separate and unchanged.

**[Open the live app](https://rangane90.github.io/verbwerk/)** — launch the German vocabulary trainer.

## App

- Home, Practice and Library sections.
- Daily verb lessons now draw from 1,187 merged verb entries: the original 28 course verbs keep their first six-day sequence, then five new verbs are introduced per day from the expanded bank. Article lessons and article review use 2,449 single-article entries from the 2,600 browsable nouns, after the existing course sequence. Progress, pronunciation, and backup import/export remain supported.
- Persistent light/dark theme and regular or 0.7× German browser-voice playback.
- General German vocabulary library and separate practice across A1-C2, with 891 active entries: a 705-entry CC BY 4.0 source core, 24 Wikidata supplements, 77 EverFlip supplements and 85 DWDS-checked additions. The All words Library view is the main searchable vocabulary list. Grammar stays separate; specialized collections are grouped under More collections. Search and word type are the primary controls; an optional review-status filter is available under More filters. Matching meanings combine while distinct senses remain separate. Konnektoren includes conjunctions and selected connecting adverbs. The separate Wordly reference also supports word-type filtering.
- The 50-entry Wikidata Lexeme pilot remains available as a separate library.
- General words can be saved, practiced as a personal collection, reviewed with per-word intervals, and recalled by typing. Review state is stored with existing progress and included in backup export/import.
- Vocabulary cards in Wortschatz, the 50-word pilot, verb library, article nouns, and Wordly frequency list support regular and 0.7× pronunciation plus card-level detail. Frequency details reuse an exact curated word-and-type match where available. Other Wordly entries show their source gloss and rank and clearly state when a reviewed example is unavailable.
- The existing learner progress key remains verbwerk_local_v1; general vocabulary progress is stored separately.

The Library’s Grammatik view has short reference cards, original examples and optional self-checks for nine topics.

## Vocabulary data

The Library includes a separate offline Wordly reference of 5,000 German entries, searchable in German or English across five frequency bands. General vocabulary practice prioritizes missed entries, then unseen entries in Wordly rank order where the lemma and word class match. Existing learner progress and curated vocabulary IDs are retained.

The general A1-C2 runtime is derived from the Lexicon Platform source revision e45c6d558898b31214a15fda907189c3c43bc511. The deployed app bundles the compact runtime for offline use. Full source-pack files, the combined source dataset, and reproducible builders are retained in the development workspace and are not included in the static site deployment. This is a curated source snapshot, not an exhaustive German dictionary or an official CEFR vocabulary list.

Lexicon Platform data is CC BY 4.0; supplemental Wikidata lexical facts are CC0 1.0; and the selected EverFlip card facts and new Verbwerk learner text are CC BY 4.0. See VOCABULARY-LICENSE.md for attribution and source-selection details.

## Online-ready vocabulary data

The V11 service worker checks the general vocabulary runtime, Wordly reference data and `vocabulary-manifest.json` online first, then stores successful responses for offline use. If the network is unavailable, it serves the most recently cached copy. The manifest records dataset version, source revision, license, entry counts and SHA-256. After updating the dataset, run `scripts/update-vocabulary-manifest.ps1` so the manifest reflects the new asset. Publishing updated static assets is still a manual repository release; the preview does not yet connect to a database service.

## Offline behavior

The service worker bundles the app shell and vocabulary runtime. Its V11 cache key is verbwerk-v11-online-16. The offline cache includes the unified Library index. Local progress remains available offline. No sign-in or cross-device cloud sync is connected; that requires a backend and an authentication decision. Physical iPhone Safari gestures still need a device check.

## Verification

- Node syntax checks passed for the root JavaScript files and sw.js; all five inline script blocks in index.html parsed successfully.
- The vocabulary sanity script passed: 896 records, 891 approved active entries, unique active IDs, and required structural fields. It also checked article metadata for the frequency noun rows. These structural checks do not confirm every translation or example linguistically.
- The generated vocabulary manifest SHA-256 matches the bundled general vocabulary runtime.
- Local Chrome QA covered daily verb lesson completion and saved progress, the expanded verb bank and article lesson bank, article feedback, quick/deep revision and tests, mixed verb/article practice, general vocabulary recall, Library search/details/sense separation, the 5,396-entry combined list, 1,190 verb entries, 2,620 noun entries, 2,599 browsable article entries, 2,449 scheduled lesson slots, and 2,444 single-article practice entries, the 5,000-entry frequency list, 50 starter words, in-app Grammar self-checks, theme persistence, and Home/Back navigation. The current build showed no browser console errors during these checks.
- The service-worker online refresh/offline fallback, backup import through the browser file picker, exported backup contents, and physical iPhone swipe gestures were not verified. Structural dataset checks are not a substitute for full linguistic proofreading.

## Release

Version 11 is published from the main branch at https://rangane90.github.io/verbwerk/.





The noun collection is extended with the 2,533 noun rows from the Wordly frequency index, each carrying article options or an explicit note. Multi-article forms are shown together and are excluded from single-answer article practice; frequency-only nouns with one article join the article practice bank after the existing course sequence. The More collections menu displays the current source counts. The frequency introduction is intentionally brief; source/license details remain in VOCABULARY-LICENSE.md.

## Study database export

Run `python scripts/export-study-database.py PATH_TO_STUDY.sqlite .` from the app directory to regenerate `vocabulary-latest-database.js` and its manifest entry. The browser loads this versioned asset offline. It uses the database’s stable sense IDs and mappings for the Library collections, and preserves course lesson order and existing article lesson slots. The service-worker cache revision for this build is `verbwerk-v11-online-16`.

Bilingual examples and grammar that require editorial review are labeled in the study interface. The app scores article answers only for a fixed reviewed article and uses reviewed usage patterns for the scored verb-pattern test. Article cards show plural forms or usage notes from the same entry as the Library. The provenance and example credits travel with the browser export.

## Local vocabulary review

The V11 development copy contains the locally reviewed study export 2026-11-11.4, generated from data/vocabulary/verbwerk-v11-study-reviewed.sqlite. Review batches v11-vocabulary-review-01 through -66 preserve the source hash and decision trail. The 3,598 candidate-only example fields are resolved: 2,941 source examples were accepted after review and 657 were replaced with editorial examples. All 471 candidate noun-plural fields are reviewed. No candidate-only bilingual examples or candidate noun plurals remain. The review also corrected several prior entry-to-gloss mismatches and separated the noun Cross from the distinct adverb cross.

Other candidate grammar fields remain in the data and stay labeled and excluded from scored questions. The study database passes SQLite integrity and foreign-key checks; its 5,396 stable entry IDs are retained. The export and review scripts verify input and output hashes, and the offline asset cache version is updated for this build.