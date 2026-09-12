# Deploy LiveKit Edge Function to Muta project.
# Requires: .env.supabase.local (SUPABASE_ACCESS_TOKEN=sbp_...) + .env.livekit.local
# Usage: powershell -File scripts/livekit-deploy.ps1

$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $PSScriptRoot
Set-Location $root

$sbFile = Join-Path $root '.env.supabase.local'
if (Test-Path $sbFile) {
  Get-Content $sbFile | ForEach-Object {
    if ($_ -match '^\s*SUPABASE_ACCESS_TOKEN=(.+)$') {
      $env:SUPABASE_ACCESS_TOKEN = $Matches[1].Trim()
    }
  }
}
if (-not $env:SUPABASE_ACCESS_TOKEN) {
  Write-Error 'Set SUPABASE_ACCESS_TOKEN or create .env.supabase.local'
}

$secretsFile = Join-Path $root '.env.livekit.local'
if (-not (Test-Path $secretsFile)) {
  Write-Error 'Missing .env.livekit.local (LIVEKIT_URL, LIVEKIT_API_KEY, LIVEKIT_API_SECRET)'
}

$vals = @{}
Get-Content $secretsFile | ForEach-Object {
  if ($_ -match '^\s*#' -or $_ -notmatch '=') { return }
  $k, $v = $_.Split('=', 2)
  $vals[$k.Trim()] = $v.Trim()
}

foreach ($req in @('LIVEKIT_URL','LIVEKIT_API_KEY','LIVEKIT_API_SECRET')) {
  if (-not $vals[$req]) { Write-Error "Missing $req in .env.livekit.local" }
}

$projectRef = 'vdkqrqtrftzhbtquzked'

Write-Host 'Setting secrets ...'
npx supabase secrets set `
  "LIVEKIT_URL=$($vals.LIVEKIT_URL)" `
  "LIVEKIT_API_KEY=$($vals.LIVEKIT_API_KEY)" `
  "LIVEKIT_API_SECRET=$($vals.LIVEKIT_API_SECRET)" `
  --project-ref $projectRef

Write-Host 'Deploying livekit-token ...'
npx supabase functions deploy livekit-token --project-ref $projectRef

Write-Host 'Done. Dashboard: https://supabase.com/dashboard/project/vdkqrqtrftzhbtquzked/functions'
