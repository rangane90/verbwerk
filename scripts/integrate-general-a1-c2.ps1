$ErrorActionPreference='Stop'
$root=(Get-Location).Path
$builder=Join-Path $root 'scripts\build-vocabulary-runtime.ps1'
$builderText=[IO.File]::ReadAllText($builder)
$old='$plurals=@($forms|Where-Object {$_.number -eq ''pl''}|ForEach-Object {$_.surface}|Sort-Object -Unique)'
$new='$plurals=@($forms|Where-Object {$_.number -eq ''pl'' -and $_.role -eq ''core'' -and $_.case -eq ''nom''}|ForEach-Object {$_.surface}|Sort-Object -Unique)'
if(-not $builderText.Contains($old)){throw 'Could not locate plural-form selection in runtime builder.'}
$builderText=$builderText.Replace($old,$new)
[IO.File]::WriteAllText($builder,$builderText,[Text.UTF8Encoding]::new($false))
& $builder
$indexPath=Join-Path $root 'index.html'
$lines=[IO.File]::ReadAllLines($indexPath)
$out=[Collections.Generic.List[string]]::new()
for($i=0;$i -lt $lines.Length;$i++){
  $line=$lines[$i]
  if($line.StartsWith('<div class="pillrow" id="libraryKinds"')){
    $out.Add('<div class="pillrow" id="libraryKinds"><button class="pill active" data-library-kind="general" onclick="setLibraryKind(''general'',this)">General A1-C2</button><button class="pill" data-library-kind="pilot" onclick="setLibraryKind(''pilot'',this)">50-word pilot</button><button class="pill" data-library-kind="verbs" onclick="setLibraryKind(''verbs'',this)">Verb library</button><button class="pill" data-library-kind="articles" onclick="setLibraryKind(''articles'',this)">Article nouns</button></div>')
  } elseif($line.StartsWith('<div id="pilotPanel"')){
    $out.Add('<div id="generalLibraryPanel" class="hidden"><div class="card"><div class="verb-row"><div><b>General German vocabulary</b><div class="meaning">A curated core across CEFR levels A1-C2. Source assignments are not an exhaustive dictionary.</div></div><span class="tag">A1-C2</span></div><div class="small">705 active records across 664 concepts, including expressions. Available offline.</div></div><input class="search" id="generalLibrarySearch" placeholder="Search German or English..." oninput="renderGeneralLibrary()"><div class="small">CEFR level</div><div class="pillrow" id="generalLevelFilters"></div><div class="small">Word type</div><div class="pillrow" id="generalPosFilters"></div><div class="sub" id="generalLibraryCount"></div><div id="generalLibraryList"></div><div id="generalShowMore" class="actions"><button class="btn secondary full" onclick="showMoreGeneral()">Show more entries</button></div><p class="footer-note">Lexicon Platform data, licensed under CC BY 4.0. <a href="./VOCABULARY-LICENSE.md#general-german-vocabulary-corpus-a1-c2">Source and attribution</a>.</p></div>')
    $out.Add($line)
  } elseif($line.StartsWith('<div id="articleLibraryPanel"')){
    $out.Add('<div id="articleLibraryPanel" class="hidden"><div class="section-head"><h2>Article nouns</h2><span class="sub" id="articleLibraryCount">Gender and plural forms</span></div><input class="search" id="articleLibrarySearch" placeholder="Search nouns or English..." oninput="renderArticleLibrary()"><div id="articleLibrary"></div></div>')
  } elseif($line.StartsWith('<button class="mode-card active" id="trackVocab"')){
    $out.Add('<button class="mode-card active" id="trackVocab" onclick="setPracticeTrack(''vocab'')">Verb course<small>Existing verb meanings and usage.</small></button><button class="mode-card" id="trackArticles" onclick="setPracticeTrack(''articles'')">Articles<small>Gender and noun recall.</small></button><button class="mode-card" id="trackBoth" onclick="setPracticeTrack(''both'')">Both<small>Mixed verb and article practice.</small></button><button class="mode-card" id="trackGeneral" onclick="setPracticeTrack(''general'')">General A1-C2<small>Words and expressions by CEFR level.</small></button></div>')
    $i+=2
    $out.Add('<div id="generalPracticeLevelPanel" class="hidden"><div class="small">Choose a CEFR level</div><div class="pillrow" id="generalPracticeLevels"></div><div class="small" id="generalPracticeInfo"></div></div>')
  } else {
    $out.Add($line)
  }
}
$html=[string]::Join([Environment]::NewLine,$out)
$html=$html.Replace('openLibrary(''pilot'')','openLibrary(''general'')')
$html=$html.Replace('openLibrary(''pilot'',this)','openLibrary(''general'',this)')
$html=$html.Replace('<div class="section-head"><h2>By level</h2></div>','<div class="card"><b>General vocabulary progress</b><div class="small" id="generalProgressSummary">No general practice answers yet.</div></div><div class="section-head"><h2>By level</h2></div>')
$html=$html.Replace('<script src="./vocabulary-pilot.js"></script>','<script src="./vocabulary-general-a1-c2.js"></script>'+[Environment]::NewLine+'<script src="./vocabulary-pilot.js"></script>')
$bridge=@'
<script>
window.VW_APP_ACCESS={
baseArticles:VW_ARTICLES,
get state(){return state},set state(v){state=v},
get track(){return vwTrack},set track(v){vwTrack=v},
get difficulty(){return vwDifficulty},set difficulty(v){vwDifficulty=v},
get articleMode(){return vwArticleMode},set articleMode(v){vwArticleMode=v},
get articleItems(){return vwArticleItems},set articleItems(v){vwArticleItems=v},
get articleIndex(){return vwArticleIndex},set articleIndex(v){vwArticleIndex=v},
get articleScore(){return vwArticleScore},set articleScore(v){vwArticleScore=v},
get articleDone(){return vwArticleDone},set articleDone(v){vwArticleDone=v},
get articleChoice(){return vwArticleChoice},set articleChoice(v){vwArticleChoice=v}
};
</script>
<script src="./vocabulary-general-ui.js"></script>
'@
$html=$html.Replace('</body>',$bridge+[Environment]::NewLine+'</body>')
[IO.File]::WriteAllText($indexPath,$html,[Text.UTF8Encoding]::new($false))
$swPath=Join-Path $root 'sw.js'
$sw=[IO.File]::ReadAllText($swPath)
$sw=$sw.Replace("'./vocabulary-pilot.js'","'./vocabulary-pilot.js','./vocabulary-general-a1-c2.js','./vocabulary-general-ui.js'")
[IO.File]::WriteAllText($swPath,$sw,[Text.UTF8Encoding]::new($false))
$readmePath=Join-Path $root 'README.md'
$readme=[IO.File]::ReadAllText($readmePath)
$readme=$readme.Replace('The pilot data is bundled with the app.','The 50-entry pilot and compact A1-C2 runtime vocabulary are bundled for offline use; the full source packs remain under data/vocabulary/general-a1-c2/.')
$readme=$readme.Replace('It has not yet been connected to the app screens.','The 705 active entries now appear in the General A1-C2 Library, separate word practice, and the expanded article library. The first 25 article-training nouns retain their existing order.')
$readme=$readme.Replace('The service worker bundles the pilot for offline use','The service worker bundles the pilot and general A1-C2 runtime for offline use')
[IO.File]::WriteAllText($readmePath,$readme,[Text.UTF8Encoding]::new($false))
$licensePath=Join-Path $root 'VOCABULARY-LICENSE.md'
$license=[IO.File]::ReadAllText($licensePath)
$license=$license.Replace('The corpus is prepared as data only and is not yet integrated into the app interface.','The compact derived runtime is bundled for offline use and shown in the General A1-C2 Library and separate practice track. The full, unmodified source pack records remain in data/vocabulary/general-a1-c2/source-packs/. The app filters out the five source records marked deprecated.')
[IO.File]::WriteAllText($licensePath,$license,[Text.UTF8Encoding]::new($false))
Write-Output 'Updated the v8 Library, practice, article bank, service worker and source notes.'
