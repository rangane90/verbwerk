$ErrorActionPreference='Stop'
$root=Split-Path -Parent $PSScriptRoot
$dataPath=Join-Path $root 'data\vocabulary\general-a1-c2\vocabulary.json'
$outputPath=Join-Path $root 'vocabulary-general-a1-c2.js'
$utf8=[System.Text.UTF8Encoding]::new($false)
$dataset=Get-Content -LiteralPath $dataPath -Raw | ConvertFrom-Json
$runtimeEntries=[System.Collections.ArrayList]::new()
foreach($pack in $dataset.packs) {
  $content=$pack.content
  $lexByConcept=@{};$formsByLexeme=@{};$defsByConcept=@{};$examplesByConcept=@{}
  foreach($x in $content.lexemes){$key=[string]$x.concept_id;if(-not $lexByConcept.ContainsKey($key)){$lexByConcept[$key]=[System.Collections.ArrayList]::new()};[void]$lexByConcept[$key].Add($x)}
  foreach($x in $content.lexeme_forms){$key=[string]$x.lexeme_id;if(-not $formsByLexeme.ContainsKey($key)){$formsByLexeme[$key]=[System.Collections.ArrayList]::new()};[void]$formsByLexeme[$key].Add($x)}
  foreach($x in $content.concept_definitions){$key=[string]$x.concept_id;if(-not $defsByConcept.ContainsKey($key)){$defsByConcept[$key]=[System.Collections.ArrayList]::new()};[void]$defsByConcept[$key].Add($x)}
  foreach($x in $content.examples){$key=[string]$x.concept_id;if(-not $examplesByConcept.ContainsKey($key)){$examplesByConcept[$key]=[System.Collections.ArrayList]::new()};[void]$examplesByConcept[$key].Add($x)}
  foreach($lex in @($content.lexemes|Where-Object {$_.lang -eq 'de'})) {
    $cid=[string]$lex.concept_id
    $siblings=@($lexByConcept[$cid].ToArray())
    $formsRaw=if($formsByLexeme.ContainsKey([string]$lex.lexeme_id)){@($formsByLexeme[[string]$lex.lexeme_id].ToArray()|Sort-Object sort_order)}else{@()}
    $forms=@($formsRaw|ForEach-Object {[ordered]@{surface=$_.surface;number=$_.number_value;case=$_.grammatical_case;role=$_.form_role;tags=$_.tags_json}})
    $core=@($forms|Where-Object {$_.role -eq 'core' -and $_.number -ne 'pl'})
    $display=[string]$lex.text;if($core.Count){$display=[string]$core[0].surface}
    $plurals=@($forms|Where-Object {$_.number -eq 'pl' -and $_.role -eq 'core' -and $_.case -eq 'nom'}|ForEach-Object {$_.surface}|Sort-Object -Unique)
    $trans=@($siblings|Where-Object {$_.lang -eq 'en'}|Sort-Object @{Expression={if($_.is_primary){0}else{1}}},@{Expression={$_.lemma}}|ForEach-Object {[ordered]@{term=$_.text;lemma=$_.lemma;primary=$_.is_primary;meaning_status=$_.meaning_status}})
    $defRows=if($defsByConcept.ContainsKey($cid)){@($defsByConcept[$cid].ToArray())}else{@()}
    $enDef=@($defRows|Where-Object {$_.lang -eq 'en'}|Select-Object -First 1)
    $deDef=@($defRows|Where-Object {$_.lang -eq 'de'}|Select-Object -First 1)
    $exampleRows=if($examplesByConcept.ContainsKey($cid)){@($examplesByConcept[$cid].ToArray())}else{@()}
    $examples=@($exampleRows|Where-Object {$_.lang -eq 'de'}|ForEach-Object {[ordered]@{sentence=$_.sentence;translation_language=$_.translation_lang;translation=$_.translation_text}})
    $gender=[string]$lex.gender;$article=$null
    if($lex.pos -eq 'noun'){switch($gender){'masc'{$article='der'}'fem'{$article='die'}'neut'{$article='das'}}}
    [void]$runtimeEntries.Add([ordered]@{
      id=[string]$lex.lexeme_id
      concept_id=$cid
      source_pack=$pack.pack
      entry_kind=$pack.kind
      level=$(if($pack.content.concepts|Where-Object {$_.concept_id -eq $cid -and $_.level_override}){@(($pack.content.concepts|Where-Object {$_.concept_id -eq $cid})|Select-Object -First 1).level_override}else{@(($pack.content.concepts|Where-Object {$_.concept_id -eq $cid})|Select-Object -First 1).level_auto})
      lemma=[string]$lex.lemma
      display_form=$display
      part_of_speech=[string]$lex.pos
      article=$article
      gender=$gender
      plural_forms=$plurals
      forms=$forms
      english_terms=$trans
      meaning=$(if($enDef.Count){$enDef[0].short_definition}else{''})
      german_definition=$(if($deDef.Count){$deDef[0].short_definition}else{''})
      german_examples=$examples
      domains=@((($content.concepts|Where-Object {$_.concept_id -eq $cid}|Select-Object -First 1).domain_tags))
      status=[string]$lex.status
      is_active=$lex.is_active
      is_primary=$lex.is_primary
    })
  }
}
$sourceEntryCount=$runtimeEntries.Count
if($sourceEntryCount -ne $dataset.metadata.german_lexeme_entry_count){throw "Lexicon source entry count mismatch: $sourceEntryCount."}
$knownIds=@{};foreach($item in $runtimeEntries){$knownIds[[string]$item.id]=$true}
$supplementActiveCount=0
$supplementEntryCount=0
$supplementDirs=@('verbwerk_wikidata_supplement_v1','verbwerk_everflip_de_supplement_v1','verbwerk_dwds_review_v1','verbwerk_dwds_audit_v2','verbwerk_dwds_curation_v3')
foreach($supplementName in $supplementDirs){
  $supplementDir=Join-Path $root ('data\vocabulary\general-a1-c2\source-packs\'+$supplementName)
  $supplementContent=Get-Content -LiteralPath (Join-Path $supplementDir 'content.json') -Raw | ConvertFrom-Json
  $supplementManifest=Get-Content -LiteralPath (Join-Path $supplementDir 'manifest.json') -Raw | ConvertFrom-Json
  if($supplementContent.pack_id -ne $supplementManifest.pack_id){throw "Supplement pack ID mismatch in $supplementName."}
  if($supplementContent.entries.Count -ne $supplementManifest.entry_count){throw "Supplement entry count does not match its manifest in $supplementName."}
  if($supplementContent.pack_id.Replace('.','_') -ne $supplementName){throw "Supplement directory and pack ID do not match in $supplementName."}
  foreach($item in $supplementContent.entries){
    if(-not $item.id -or $knownIds.ContainsKey([string]$item.id)){throw "Missing or duplicate supplemental entry ID: $($item.id)."}
    if($item.source_pack -ne $supplementName){throw "Unexpected source pack on $($item.id)."}
    $knownIds[[string]$item.id]=$true
    [void]$runtimeEntries.Add($item)
  }
  $supplementEntryCount += $supplementContent.entries.Count
  $supplementActiveCount += @($supplementContent.entries|Where-Object {$_.status -eq 'approved' -and $_.is_active -ne $false}).Count
}
$reviewPacks=@("verbwerk_dwds_review_v1","verbwerk_dwds_audit_v2","verbwerk_dwds_curation_v3")
$corrections=@(foreach($reviewPack in $reviewPacks){
  $reviewDir=Join-Path $root ("data/vocabulary/general-a1-c2/source-packs/"+$reviewPack)
  Get-Content -LiteralPath (Join-Path $reviewDir "corrections.json") -Raw | ConvertFrom-Json
})
foreach($correction in $corrections){
  $entry=$runtimeEntries | Where-Object {$_.id -ceq $correction.id} | Select-Object -First 1
  if(-not $entry -or $entry.lemma -cne $correction.expected_lemma){throw "Vocabulary correction no longer matches: $($correction.id)."}
  foreach($field in $correction.fields.PSObject.Properties){
    if($entry -is [System.Collections.IDictionary]){$entry[$field.Name]=$field.Value}
    else{$entry | Add-Member -NotePropertyName $field.Name -NotePropertyValue $field.Value -Force}
  }
}
$activeEntryCount=[int]$dataset.metadata.approved_german_lexeme_entries+$supplementActiveCount
if($runtimeEntries.Count -ne ($sourceEntryCount+$supplementEntryCount)){throw 'Combined runtime entry count mismatch.'}
$payload=[ordered]@{
  metadata=[ordered]@{
    dataset_id=$dataset.metadata.dataset_id
    version=$dataset.metadata.dataset_version
    levels=$dataset.metadata.levels
    count=$runtimeEntries.Count
    active_count=$activeEntryCount
    source='Lexicon Platform + Wikidata, EverFlip and DWDS-reviewed supplements'
    source_revision=$dataset.metadata.source_revision
    license='CC BY 4.0 for Lexicon and EverFlip content; Wikidata lexical facts are CC0-1.0; DWDS headword data is CC BY-SA 4.0; see VOCABULARY-LICENSE.md'
    attribution='Lexicon Platform lexical data by Massimo Mazzariol and contributors, CC BY 4.0; EverFlip Multilingual Flashcard Corpus, version 1.0.0, CC BY 4.0; Wikidata Lexeme facts CC0-1.0. See source notes.'
  }
  entries=@($runtimeEntries.ToArray())
}
$json=$payload|ConvertTo-Json -Depth 100 -Compress
$script='window.VW_GENERAL_DATA = '+$json+';'
[System.IO.File]::WriteAllText($outputPath,$script,$utf8)
Write-Output "Wrote runtime library with $($runtimeEntries.Count) entries ($activeEntryCount approved and active)."
Write-Output ("Runtime data size: " + (Get-Item -LiteralPath $outputPath).Length + " bytes.")