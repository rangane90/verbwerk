# Verbwerk simple iPhone navigation patch

This patch removes dynamically inserted per-page Back/Home buttons. It uses the existing Today tab as the single in-app route to Home.

Navigation behaviour:
- First move from Home to any secondary screen creates one browser-history entry.
- Switching between internal screens replaces that entry instead of stacking more history entries.
- iPhone/Safari browser Back or edge-swipe returns to Home.
- Tapping the existing Today tab also returns to Home.
- Once already on Home, normal browser Back is not intercepted.
- No additional back buttons are injected into pages.

Existing lesson, review, article and progress code is retained. The `verbwerk_local_v1` storage key is unchanged.

Deploy by backing up progress, unzipping, uploading all files in this folder to the root of `rangane90/verbwerk`, replacing matching files, committing, and waiting for GitHub Pages. Then refresh iPhone using `?refresh=5`.

The scripts pass Node syntax checks. iOS edge-swipe behaviour must still be confirmed on the actual device. In an installed Home Screen PWA, iOS does not provide a universal app-level swipe-back gesture; the persistent Today tab is therefore the reliable in-app way to return Home.


## v6 audit and maintenance release
- Hardened backup import with size limits, schema validation, field allow-lists, and safe history-text sanitisation.
- Kept existing local progress key (`verbwerk_local_v1`) and normalised recognised progress fields.
- Added a clear storage-write failure message.
- Scoped service-worker cache cleanup to caches whose names begin with `verbwerk-`.
- Corrected verb lesson sequencing so remaining A2.2 verbs are not skipped before B1.1 entries unlock on 3 December 2026.
- Prevented article lessons from repeating old nouns as if they were new lessons after the bundled set is exhausted.
- Mixed practice now draws from the learner's known/weak vocabulary and learned article set rather than always starting with the same first five items.
- Deep Test now requires a typed English-meaning answer; Deep Revision remains guided.
- Navigation behaviour remains unchanged from the previously confirmed simple-navigation release.

Automated checks completed: all three inline JavaScript blocks pass Node syntax validation; service-worker syntax passes; manifest JSON parses; no duplicate HTML IDs were found.

Not completed in this environment: physical iPhone/iOS Safari testing, browser-driven end-to-end tests (no browser executable available), external penetration testing, and real offline testing on the deployed GitHub Pages origin.
