$ErrorActionPreference = 'Stop'

$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$rootDir = Resolve-Path (Join-Path $scriptDir '..')

$frontendDir = Join-Path $rootDir 'frontend'
$frontendDistDir = Join-Path $frontendDir 'dist'
$backendPublicAppDir = Join-Path $rootDir 'backend\public\app'

Write-Host '[demo:build] Building frontend...'
Push-Location $frontendDir
try {
  npm run build -- --base=/app/
}
finally {
  Pop-Location
}

if (-not (Test-Path $frontendDistDir)) {
  throw "[demo:build] Frontend dist directory not found: $frontendDistDir"
}

Write-Host '[demo:build] Syncing dist to backend/public/app...'
if (Test-Path $backendPublicAppDir) {
  Remove-Item -Path $backendPublicAppDir -Recurse -Force
}
New-Item -Path $backendPublicAppDir -ItemType Directory -Force | Out-Null
Copy-Item -Path (Join-Path $frontendDistDir '*') -Destination $backendPublicAppDir -Recurse -Force

Write-Host '[demo:build] Done.'
Write-Host '[demo:build] Start backend and open: http://localhost:1337/app/'
