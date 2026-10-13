Set-Location (Join-Path $PSScriptRoot "..")
docker build -t pm .
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
docker rm -f pm *> $null
docker run -d --name pm -p 8000:8000 --env-file .env -v pm-data:/data pm
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
Write-Host "Running at http://localhost:8000"
