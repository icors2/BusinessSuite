#!/usr/bin/env bash
# Run the Business Suite demo from GHCR (no clone, no local build).
#
# One-liner (copy/paste without this script):
#   curl -fsSL -o docker-compose.ghcr.yml \
#     https://raw.githubusercontent.com/icors2/BusinessSuite/demo/docker-compose.ghcr.yml \
#     && docker compose -f docker-compose.ghcr.yml up -d --pull always
#
set -euo pipefail

COMPOSE_FILE="${COMPOSE_FILE:-docker-compose.ghcr.yml}"
COMPOSE_URL="https://raw.githubusercontent.com/icors2/BusinessSuite/demo/docker-compose.ghcr.yml"

if [ ! -f "$COMPOSE_FILE" ]; then
  echo "Downloading $COMPOSE_FILE..."
  curl -fsSL -o "$COMPOSE_FILE" "$COMPOSE_URL"
fi

echo "Starting demo stack (pull latest GHCR images)..."
docker compose -f "$COMPOSE_FILE" up -d --pull always

echo ""
echo "Demo starting — first boot may take 1–2 minutes (migrations + seed)."
echo "  Web UI:      http://localhost:8080"
echo "  API health:  http://localhost:3000/api/health"
echo ""
echo "Login: admin@arcncode.local / Admin123!"
echo "Stop:  docker compose -f $COMPOSE_FILE down"
echo "Reset: docker compose -f $COMPOSE_FILE down -v"
