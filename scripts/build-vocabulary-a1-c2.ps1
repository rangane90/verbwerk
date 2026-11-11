$ErrorActionPreference='Stop'
$ProgressPreference='SilentlyContinue'
$sourceRevision='e45c6d558898b31214a15fda907189c3c43bc511'
$sourceDate='2026-10-19'
$rawBase="https://raw.githubusercontent.com/massimomazzariol/Lexicon/$sourceRevision"
$repoUrl='https://github.com/massimomazzariol/Lexicon'
$root=Split-Path -Parent $PSScriptRoot
$dataRoot=Join-Path $root 'data\vocabulary\general-a1-c2'
$sourceRoot=Join-Path $dataRoot 'source-packs'
$utf8=[System.Text.UTF8Encoding]::new($false)
$headers=@{'User-Agent'='Verbwerk-vocabulary-builder';'Accept'='application/json,text/plain,*/*'}
$levels=@('A1','A2','B1','B2','C1','C2')
$kinds=@([pscustomobject]@{suffix='';kind='vocabulary'},[pscustomobject]@{suffix='_expressions';kind='expression'})
$packs=[System.Collections.ArrayList]::new()
$stats=[System.Collections.ArrayList]::new()
$allConceptIds=@{}
$allEntryIds=@{}
$totalNouns=0;$nounsWithGender=0;$nounsWithPlural=0
$totalEntries=0;$approvedEntries=0;$deprecatedEntries=0
$reviewedConcepts=0;$englishDefinitions=0;$germanDefinitions=0
function SaveText([string]$path,[string]$text) {
  [System.IO.Directory]::CreateDirectory((Split-Path -Parent $path)) | Out-Null
  [System.IO.File]::WriteAllText($path,$text,$utf8)
}
function FetchText([string]$url) {
  $response=Invoke-WebRequest -Uri $url -Headers $headers -UseBasicParsing
  return [string]$response.Content
}
foreach($level in $levels) {
  foreach($kind in $kinds) {
    $packName="lexicon_de_$($level.ToLower())$($kind.suffix)"
    $contentRaw=FetchText "$rawBase/packs/$packName/content.json"
    $manifestRaw=FetchText "$rawBase/packs/$packName/manifest.json"
    $packDir=Join-Path $sourceRoot $packName
    SaveText (Join-Path $packDir 'content.json') $contentRaw
    SaveText (Join-Path $packDir 'manifest.json') $manifestRaw
    $content=ConvertFrom-Json -InputObject $contentRaw
    $packManifest=ConvertFrom-Json -InputObject $manifestRaw
    $deLexemes=@($content.lexemes | Where-Object {$_.lang -eq 'de'})
    $nouns=@($deLexemes | Where-Object {$_.pos -eq 'noun'})
    $formsByLexeme=@{}
    foreach($form in $content.lexeme_forms) {
      $key=[string]$form.lexeme_id
      if(-not $formsByLexeme.ContainsKey($key)) {$formsByLexeme[$key]=[System.Collections.ArrayList]::new()}
      [void]$formsByLexeme[$key].Add($form)
    }
    foreach($noun in $nouns) {
      if($noun.gender -in @('masc','fem','neut')) {$nounsWithGender++}
      if($formsByLexeme.ContainsKey([string]$noun.lexeme_id) -and @($formsByLexeme[[string]$noun.lexeme_id] | Where-Object {$_.number_value -eq 'pl'}).Count) {$nounsWithPlural++}
    }
    $totalNouns+=$nouns.Count;$totalEntries+=$deLexemes.Count
    $approvedEntries+=@($deLexemes | Where-Object {$_.status -eq 'approved'}).Count
    $deprecatedEntries+=@($deLexemes | Where-Object {$_.status -eq 'deprecated'}).Count
    $englishDefinitions+=@($content.concept_definitions | Where-Object {$_.lang -eq 'en'} | Select-Object -ExpandProperty concept_id -Unique).Count
    $germanDefinitions+=@($content.concept_definitions | Where-Object {$_.lang -eq 'de'} | Select-Object -ExpandProperty concept_id -Unique).Count
    foreach($concept in $content.concepts) {
      $allConceptIds[[string]$concept.concept_id]=$true
      if($concept.review_status -eq 'reviewed') {$reviewedConcepts++}
    }
    foreach($lexeme in $deLexemes) {
      $entryId=[string]$lexeme.lexeme_id
      if($allEntryIds.ContainsKey($entryId)) {throw "Duplicate German lexeme ID $entryId."}
      $allEntryIds[$entryId]=$true
    }
    [void]$packs.Add([ordered]@{pack=$packName;kind=$kind.kind;level=$level;manifest=$packManifest;content=$content})
    [void]$stats.Add([pscustomobject]@{
      pack=$packName;kind=$kind.kind;level=$level;version=$packManifest.version
      generated_at=$packManifest.generated_at;license=$packManifest.license_info
      concepts=$content.concepts.Count;german_lexemes=$deLexemes.Count;nouns=$nouns.Count
    })
  }
}
if($packs.Count -ne 12) {throw "Expected 12 source packs, found $($packs.Count)."}
if($allConceptIds.Count -ne 664) {throw "Unexpected source concept count: $($allConceptIds.Count)."}
if($totalEntries -ne 710) {throw "Unexpected German lexeme entry count: $totalEntries."}
if($nounsWithGender -ne $totalNouns) {throw 'At least one noun lacks gender.'}
if($englishDefinitions -ne 664 -or $germanDefinitions -ne 664) {throw 'German or English definition coverage is incomplete.'}
$levelCounts=@(foreach($level in $levels) {
  $levelStats=@($stats | Where-Object {$_.level -eq $level})
  [pscustomobject]@{
    level=$level
    vocabulary_concepts=[int](($levelStats | Where-Object {$_.kind -eq 'vocabulary'} | Measure-Object concepts -Sum).Sum)
    expression_concepts=[int](($levelStats | Where-Object {$_.kind -eq 'expression'} | Measure-Object concepts -Sum).Sum)
    german_lexeme_entries=[int](($levelStats | Measure-Object german_lexemes -Sum).Sum)
    nouns=[int](($levelStats | Measure-Object nouns -Sum).Sum)
  }
})
$metadata=[ordered]@{
  dataset_id='verbwerk.general.de.a1-c2';dataset_name='Verbwerk General German Vocabulary A1-C2';dataset_version='1.0.0'
  language='de';interface_language='en';levels=$levels
  scope='Complete snapshot of all German vocabulary and expression packs published by the named source at the pinned revision. This is a curated core, not an exhaustive inventory of German.'
  source_name='Lexicon Platform';source_repository=$repoUrl;source_revision=$sourceRevision;source_revision_date=$sourceDate
  source_pack_count=$packs.Count;source_concept_count=$allConceptIds.Count;german_lexeme_entry_count=$totalEntries
  noun_count=$totalNouns;nouns_with_gender=$nounsWithGender;nouns_with_source_plural_forms=$nounsWithPlural
  nouns_without_source_plural_forms=$totalNouns-$nounsWithPlural
  approved_german_lexeme_entries=$approvedEntries;deprecated_german_lexeme_entries=$deprecatedEntries
  concepts_marked_reviewed=$reviewedConcepts;concepts_with_english_definitions=$englishDefinitions;concepts_with_german_definitions=$germanDefinitions
  content_license='CC BY 4.0';content_license_url='https://creativecommons.org/licenses/by/4.0/'
  source_attribution='Lexicon Platform lexical data by Massimo Mazzariol and contributors, licensed under CC BY 4.0. Modified by repackaging into one file; the source pack records remain unchanged.'
  source_packs=@($stats.ToArray());counts_by_level=$levelCounts
  notes=@(
    'The source pack level assignments are preserved without reassignment.',
    'Twenty noun entries have no plural form in the source snapshot; absent forms are left empty rather than guessed.',
    'The 50-entry Wikidata pilot remains separate. This general corpus is prepared separately and is not yet connected to the app interface.',
    'CEFR is a proficiency framework, not one exhaustive German vocabulary list.'
  )
}
$dataset=[ordered]@{schema_version=1;metadata=$metadata;packs=@($packs.ToArray())}
SaveText (Join-Path $dataRoot 'vocabulary.json') ($dataset | ConvertTo-Json -Depth 100)
SaveText (Join-Path $dataRoot 'manifest.json') ($metadata | ConvertTo-Json -Depth 100)
$attribution=@'
# Source attribution

This folder contains a modified snapshot of German vocabulary data from the Lexicon Platform by Massimo Mazzariol and contributors.

- Source repository: https://github.com/massimomazzariol/Lexicon
- Pinned source revision: e45c6d558898b31214a15fda907189c3c43bc511 (2026-10-19)
- Content license: Creative Commons Attribution 4.0 International (CC BY 4.0)
- License text: https://creativecommons.org/licenses/by/4.0/
- Changes: all six German vocabulary packs and their expression packs are combined in vocabulary.json; the source pack records remain unchanged.

Preferred attribution:
> Lexicon Platform lexical data by Massimo Mazzariol and contributors, licensed under CC BY 4.0. Modified for Verbwerk.

The content license applies to the source lexical data and its adapted snapshot. It does not change the license of Verbwerk code.
'@
SaveText (Join-Path $dataRoot 'ATTRIBUTION.md') $attribution
foreach($file in @(
  [pscustomobject]@{source='NOTICE';target='NOTICE.upstream.txt'},
  [pscustomobject]@{source='ATTRIBUTION.md';target='ATTRIBUTION.upstream.md'},
  [pscustomobject]@{source='docs/CONTENT_LICENSE.md';target='CONTENT_LICENSE.upstream.md'}
)) {
  SaveText (Join-Path $dataRoot $file.target) (FetchText "$rawBase/$($file.source)")
}
$readme=@'
# General German vocabulary A1-C2

This folder contains the complete German vocabulary and expression packs published by the Lexicon Platform at the pinned source revision. It is a curated core set for all six CEFR levels, not an exhaustive dictionary or an official CEFR word list.

## Files

- vocabulary.json is the combined dataset; all original pack fields are preserved inside its packs array.
- manifest.json records the pinned source revision, license, level counts, and structural coverage.
- source-packs/ preserves all 12 source content and manifest files unchanged.
- ATTRIBUTION.md contains the required attribution and describes the changes.
- The upstream attribution, content-license, and notice files are preserved beside it.

## Coverage

The source snapshot contains 664 concepts across A1-C2, including 61 expressions, and 710 German lexeme entries. Every concept has German and English definitions, every noun has a gender, and the source supplies plurals for 204 of 224 noun entries. Five German lexeme entries are marked deprecated by the source; their status is retained.

The CEFR framework describes language proficiency; it does not define a single exhaustive German vocabulary list. These levels and selections come from the named source. See the [Council of Europe reference-level descriptions](https://www.coe.int/en/web/common-european-framework-reference-languages/reference-level-descriptions).

## License and app status

Lexical content is licensed under CC BY 4.0. Keep the attribution in ATTRIBUTION.md when copying or redistributing the dataset. The 50-entry Wikidata pilot in the app remains a separate dataset. This general corpus is prepared separately and is not yet wired into the app interface.
'@
SaveText (Join-Path $dataRoot 'README.md') $readme
Write-Output "Built $totalEntries German lexeme entries across $($allConceptIds.Count) concepts."
Write-Output "Nouns with gender: $nounsWithGender/$totalNouns; with source plural forms: $nounsWithPlural/$totalNouns."
Write-Output "Approved: $approvedEntries; deprecated: $deprecatedEntries."
Write-Output "Source revision: $sourceRevision."
