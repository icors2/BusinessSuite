# Run the Business Suite demo from GHCR (no clone, no local build).
#
# One-liner (PowerShell):
#   Invoke-WebRequest -Uri "https://raw.githubusercontent.com/icors2/BusinessSuite/demo/docker-compose.ghcr.yml" -OutFile docker-compose.ghcr.yml; docker compose -f docker-compose.ghcr.yml up -d --pull always
#
param(
    [string]$ComposeFile = "docker-compose.ghcr.yml"
)

$ComposeUrl = "https://raw.githubusercontent.com/icors2/BusinessSuite/demo/docker-compose.ghcr.yml"

if (-not (Test-Path $ComposeFile)) {
    Write-Host "Downloading $ComposeFile..."
    Invoke-WebRequest -Uri $ComposeUrl -OutFile $ComposeFile
}

Write-Host "Starting demo stack (pull latest GHCR images)..."
docker compose -f $ComposeFile up -d --pull always

Write-Host ""
Write-Host "Demo starting — first boot may take 1–2 minutes (migrations + seed)."
Write-Host "  Web UI:      http://localhost:8080"
Write-Host "  API health:  http://localhost:3000/api/health"
Write-Host ""
Write-Host "Login: admin@arcncode.local / Admin123!"
Write-Host "Stop:  docker compose -f $ComposeFile down"
Write-Host "Reset: docker compose -f $ComposeFile down -v"
