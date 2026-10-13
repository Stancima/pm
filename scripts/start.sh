#!/usr/bin/env sh
set -e
cd "$(dirname "$0")/.."
docker build -t pm .
docker rm -f pm 2>/dev/null || true
docker run -d --name pm -p 8000:8000 --env-file .env -v pm-data:/data pm
echo "Running at http://localhost:8000"
