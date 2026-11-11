$ErrorActionPreference='Stop'
$root=(Get-Location).Path
$index=Join-Path $root 'index.html'
$html=[IO.File]::ReadAllText($index)
$html=$html.Replace('Lexicon Platform data, licensed under CC BY 4.0.','Lexicon Platform lexical data by Massimo Mazzariol and contributors, licensed under CC BY 4.0. Modified for Verbwerk.')
[IO.File]::WriteAllText($index,$html,[Text.UTF8Encoding]::new($false))
$readmePath=Join-Path $root 'README.md'
$readme=[IO.File]::ReadAllText($readmePath)
$replacement=@'
## Verification

- Source-pack integrity checks passed for the pinned 12-pack snapshot: 664 concepts, 710 German lexeme records, 705 active records, all six CEFR levels, and 204 source plural forms among 224 source nouns.
- JavaScript syntax checks passed for both vocabulary data scripts and all three inline app scripts.
- Edge smoke checks covered Home, the A1-C2 Library, the C2 practice round, general-vocabulary progress, the 230-noun article library, the first article lesson, and the existing verb quiz.
- The first 25 article nouns remain in their original order. General word progress is stored separately from the existing Verbwerk course progress.
- Browser checks used the development copy in a fresh profile; no v7 progress export was available for a before/after comparison.
- Runtime service-worker/offline behavior could not be browser-tested here: the local preview server was blocked from accepting loopback connections, and opening the app as a file does not run its service worker. The worker's asset list includes both general-vocabulary files.

'@
$readme=[regex]::Replace($readme,'(?s)## Verification.*?(?=## Release status)',[System.Text.RegularExpressions.MatchEvaluator]{param($m)$replacement})
[IO.File]::WriteAllText($readmePath,$readme,[Text.UTF8Encoding]::new($false))
$licensePath=Join-Path $root 'VOCABULARY-LICENSE.md'
$license=[IO.File]::ReadAllText($licensePath)
$license=$license.Replace('The upstream content is licensed CC BY 4.0. Required attribution and the source/license links are in data/vocabulary/general-a1-c2/ATTRIBUTION.md; upstream notice files are preserved beside it.','The upstream content is licensed CC BY 4.0. Preferred attribution: "Lexicon Platform lexical data by Massimo Mazzariol and contributors, licensed under CC BY 4.0. Modified for Verbwerk." Source repository: https://github.com/massimomazzariol/Lexicon. License text: https://creativecommons.org/licenses/by/4.0/. Full attribution and upstream notice files are in data/vocabulary/general-a1-c2/.')
[IO.File]::WriteAllText($licensePath,$license,[Text.UTF8Encoding]::new($false))
$dataReadmePath=Join-Path $root 'data\vocabulary\general-a1-c2\README.md'
$dataReadme=[IO.File]::ReadAllText($dataReadmePath)
$dataReadme=$dataReadme.Replace('The 50-entry Wikidata pilot in the app remains a separate dataset. This general corpus is prepared separately and is not yet wired into the app interface.','The 50-entry Wikidata pilot remains a separate dataset. The compact derived runtime is bundled in vocabulary-general-a1-c2.js and appears in the General A1-C2 Library, its separate practice track, and the expanded article library. Source definitions, examples and level assignments are included as supplied; Verbwerk has not individually pedagogically reviewed every record. The source marks all 664 concepts as reviewed.')
[IO.File]::WriteAllText($dataReadmePath,$dataReadme,[Text.UTF8Encoding]::new($false))
Write-Output 'Updated app attribution and final verification/source notes.'
