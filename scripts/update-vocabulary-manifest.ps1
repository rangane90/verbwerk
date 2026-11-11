$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $PSScriptRoot
$dataPath = Join-Path $root 'vocabulary-general-a1-c2.js'
$manifestPath = Join-Path $root 'vocabulary-manifest.json'
$raw = Get-Content -LiteralPath $dataPath -Raw -Encoding UTF8
$match = [regex]::Match($raw, 'window\.VW_GENERAL_DATA\s*=\s*(\{.*?\});', [System.Text.RegularExpressions.RegexOptions]::Singleline)
if (-not $match.Success) { throw 'Could not find the vocabulary dataset metadata.' }
$data = $match.Groups[1].Value | ConvertFrom-Json
$metadata = $data.metadata
$hash = (Get-FileHash -LiteralPath $dataPath -Algorithm SHA256).Hash.ToLowerInvariant()
$manifest = [ordered]@{
  dataset_id = $metadata.dataset_id
  version = $metadata.version
  entry_count = $metadata.count
  active_entry_count = $metadata.active_count
  levels = @($metadata.levels)
  source_revision = $metadata.source_revision
  license = $metadata.license
  general_data_asset = 'vocabulary-general-a1-c2.js'
  general_data_sha256 = $hash
  frequency_data_asset = 'vocabulary-wordly-de.js'
  generated_at_utc = [DateTimeOffset]::UtcNow.ToString('o')
}
$manifest | ConvertTo-Json -Depth 8 | Set-Content -LiteralPath $manifestPath -Encoding UTF8
Write-Output "Wrote $manifestPath for $($metadata.active_count) active entries, version $($metadata.version)."
