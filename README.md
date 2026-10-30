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
