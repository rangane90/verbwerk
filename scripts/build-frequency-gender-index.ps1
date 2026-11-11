param(
    [Parameter(Mandatory = $true)]
    [string]$NounCsvPath,
    [string]$OutputPath = (Join-Path $PSScriptRoot '..\vocabulary-gender-index.js'),
    [string]$WordlyPath = (Join-Path $PSScriptRoot '..\vocabulary-wordly-de.js')
)

$ErrorActionPreference = 'Stop'

function Normalize-Lemma([string]$Value) {
    if ([string]::IsNullOrWhiteSpace($Value)) { return '' }
    return $Value.Normalize([Text.NormalizationForm]::FormC).Trim().ToLowerInvariant()
}

$frequencySource = Get-Content -LiteralPath $WordlyPath -Raw -Encoding UTF8
$marker = 'window.VW_WORDLY_DE = '
$start = $frequencySource.IndexOf($marker)
$end = $frequencySource.LastIndexOf(';')
if ($start -lt 0 -or $end -le $start) { throw 'Could not find the Wordly frequency data assignment.' }
$frequencyRows = ConvertFrom-Json -InputObject $frequencySource.Substring($start + $marker.Length, $end - $start - $marker.Length)
$targets = @{}
foreach ($word in $frequencyRows | Where-Object { $_.pos -eq 'noun' }) {
    $key = Normalize-Lemma $word.lemma
    if ($key) { $targets[$key] = [string]$word.lemma }
}

$articlesByLemma = @{}
$pluralTargets = [System.Collections.Generic.HashSet[string]]::new([StringComparer]::Ordinal)
$genderNames = @{ m = 'der'; f = 'die'; n = 'das' }
$genderFields = @('genus', 'genus 1', 'genus 2', 'genus 3', 'genus 4')
$pluralFields = @('nominativ plural', 'nominativ plural*', 'nominativ plural 1', 'nominativ plural 2', 'nominativ plural 3', 'nominativ plural 4')
foreach ($row in Import-Csv -LiteralPath $NounCsvPath) {
    if (($row.pos -split ',') -notcontains 'Substantiv') { continue }

    $lemmaKey = Normalize-Lemma $row.lemma
    if ($targets.ContainsKey($lemmaKey)) {
        if (-not $articlesByLemma.ContainsKey($lemmaKey)) {
            $articlesByLemma[$lemmaKey] = [System.Collections.Generic.HashSet[string]]::new([StringComparer]::Ordinal)
        }
        foreach ($field in $genderFields) {
            $value = [string]$row.$field
            if ($genderNames.ContainsKey($value)) { [void]$articlesByLemma[$lemmaKey].Add($genderNames[$value]) }
        }
        if (-not $row.genus) {
            $singulars = @($row.'nominativ singular', $row.'genitiv singular', $row.'dativ singular', $row.'akkusativ singular') | Where-Object { -not [string]::IsNullOrWhiteSpace($_) }
            $plurals = @($row.'nominativ plural', $row.'genitiv plural', $row.'dativ plural', $row.'akkusativ plural') | Where-Object { -not [string]::IsNullOrWhiteSpace($_) }
            if ($singulars.Count -eq 0 -and $plurals.Count -gt 0) { [void]$articlesByLemma[$lemmaKey].Add('die') }
        }
    }

    foreach ($field in $pluralFields) {
        $pluralKey = Normalize-Lemma ([string]$row.$field)
        if ($targets.ContainsKey($pluralKey)) { [void]$pluralTargets.Add($pluralKey) }
    }
}

$manualArticles = @{
    'ali' = @('der')
    'be' = @('das')
    'beeilung' = @('die')
    'bitch' = @('die')
    'boy' = @('der')
    'bro' = @('der')
    'colonel' = @('der')
    'crystal' = @('das')
    'dad' = @('der')
    'doctor' = @('der')
    'durchsuchungsbefehl' = @('der')
    'englisch' = @('das')
    'französisch' = @('das')
    'girl' = @('das')
    'house' = @('der')
    'hunter' = @('der')
    'jedi' = @('der')
    'lebewohl' = @('das')
    'leo' = @('das')
    'manhattan' = @('der')
    'mercedes' = @('der')
    'michel' = @('der')
    'miststück' = @('das')
    'mum' = @('die')
    'nr.' = @('die')
    'psycho' = @('der')
    'russisch' = @('das')
    'sal' = @('das')
    'sheriff' = @('der')
    'shirt' = @('das')
    'spanisch' = @('das')
    'spike' = @('der')
    'wagen' = @('der')
    'willi' = @('der')
    'zuviel' = @('das')
}
$manualNotes = @{
    'armen' = 'Inflected form; the article depends on case and intended reading.'
    'betracht' = 'Used in the fixed phrase “in Betracht” without a standalone article.'
}

$order = @('der', 'die', 'das')
$entries = [ordered]@{}
$sourceMatches = 0
$pluralMatches = 0
$manualMatches = 0
$multiple = 0
$withoutSingleArticle = 0
foreach ($key in $targets.Keys) {
    $articles = @()
    $source = ''
    $note = ''
    if ($articlesByLemma.ContainsKey($key) -and $articlesByLemma[$key].Count -gt 0) {
        $articles = @($articlesByLemma[$key] | Sort-Object { $order.IndexOf($_) })
        $source = 'wiktionary-german-nouns'
        $sourceMatches++
    } elseif ($pluralTargets.Contains($key)) {
        $articles = @('die')
        $source = 'wiktionary-plural-form'
        $pluralMatches++
    } elseif ($manualArticles.ContainsKey($key)) {
        $articles = @($manualArticles[$key])
        $source = 'editorial-article-review'
        $manualMatches++
    } elseif ($manualNotes.ContainsKey($key)) {
        $note = $manualNotes[$key]
        $source = 'editorial-note'
        $manualMatches++
    } else {
        throw "No article or explanation found for frequency noun '$($targets[$key])'."
    }
    if ($articles.Count -gt 1) { $multiple++ }
    if ($articles.Count -eq 0) { $withoutSingleArticle++ }
    $entries[$key] = [ordered]@{ articles = $articles; source = $source; note = $note }
}

$csvHash = (Get-FileHash -LiteralPath $NounCsvPath -Algorithm SHA256).Hash.ToLowerInvariant()
$payload = [ordered]@{
    metadata = [ordered]@{
        version = '1.0.0'
        generated_at = (Get-Date -Format 'yyyy-MM-dd')
        frequency_noun_count = $targets.Count
        article_or_note_count = $entries.Count
        source_article_matches = $sourceMatches
        plural_form_matches = $pluralMatches
        editorially_reviewed_matches = $manualMatches
        multiple_article_entries = $multiple
        entries_without_one_fixed_article = $withoutSingleArticle
        source_name = 'gambolputty/german-nouns'
        source_url = 'https://github.com/gambolputty/german-nouns'
        source_file = 'german_nouns/nouns.csv'
        source_file_sha1 = 'b2bbf3c70a8a41d11581ce4e4ee2cc2425207c73'
        source_file_sha256 = $csvHash
        source_license = 'CC BY-SA 4.0'
        upstream_origin = 'German Wiktionary (WiktionaryDE)'
    }
    entries = $entries
}
$json = ConvertTo-Json -InputObject $payload -Depth 8 -Compress
$js = 'window.VW_GERMAN_NOUN_GENDERS = ' + $json + ';' + [Environment]::NewLine
$resolvedOutput = [IO.Path]::GetFullPath($OutputPath)
$outputDirectory = Split-Path -Parent $resolvedOutput
if (-not (Test-Path -LiteralPath $outputDirectory)) { New-Item -ItemType Directory -Path $outputDirectory | Out-Null }
[IO.File]::WriteAllText($resolvedOutput, $js, [Text.UTF8Encoding]::new($false))
Write-Output "Generated $OutputPath"
Write-Output "Frequency nouns: $($targets.Count); source exact: $sourceMatches; plural forms: $pluralMatches; editorial entries: $manualMatches; multi-article: $multiple; no single article: $withoutSingleArticle"
