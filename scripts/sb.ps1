# Supabase CLI wrapper — token'i .env.supabase.local'den yukler, Docker'siz deploy.
# Kullanim:
#   .\scripts\sb.ps1 functions deploy --use-api
#   .\scripts\sb.ps1 db push --linked
#   .\scripts\sb.ps1 login

$ErrorActionPreference = 'Stop'
$root = Split-Path $PSScriptRoot -Parent
Set-Location $root

$envFile = Join-Path $root '.env.supabase.local'
if (-not (Test-Path $envFile)) {
  Write-Error "Eksik: .env.supabase.local — once npm run supabase:login icin token dosyasi olustur."
}

Get-Content $envFile | ForEach-Object {
  if ($_ -match '^\s*#' -or $_ -notmatch '=') { return }
  $name, $value = $_ -split '=', 2
  $name = $name.Trim()
  $value = $value.Trim().Trim('"').Trim("'")
  if ($name) { Set-Item -Path "Env:$name" -Value $value }
}

if (-not $env:SUPABASE_ACCESS_TOKEN) {
  Write-Error "SUPABASE_ACCESS_TOKEN yok. Dashboard → Access Tokens."
}

$projectRef = if ($env:SUPABASE_PROJECT_REF) { $env:SUPABASE_PROJECT_REF } else { 'vdkqrqtrftzhbtquzked' }

if ($args.Count -eq 0) {
  Write-Host "Ornekler:"
  Write-Host "  .\scripts\sb.ps1 login"
  Write-Host "  .\scripts\sb.ps1 functions deploy --use-api"
  Write-Host "  .\scripts\sb.ps1 db push --linked"
  exit 0
}

$cmd = $args[0]
$rest = @()
if ($args.Count -gt 1) { $rest = $args[1..($args.Count - 1)] }

if ($cmd -eq 'login') {
  npx supabase login --token $env:SUPABASE_ACCESS_TOKEN
  exit $LASTEXITCODE
}

# functions deploy: Docker yoksa --use-api zorunlu
if ($cmd -eq 'functions' -and $rest.Count -ge 1 -and $rest[0] -eq 'deploy') {
  if ($rest -notcontains '--use-api') { $rest += '--use-api' }
  if ($rest -notcontains '--project-ref') {
    $rest += @('--project-ref', $projectRef)
  }
}

if ($cmd -eq 'db' -and $rest.Count -ge 1 -and $rest[0] -eq 'push') {
  if ($rest -notcontains '--linked') { $rest += '--linked' }
}

npx supabase @($cmd) @rest
exit $LASTEXITCODE
