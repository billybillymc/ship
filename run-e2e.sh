#!/bin/bash
set -euo pipefail

# Ship E2E — run this on a fresh Ubuntu server
# Usage: git clone ... && cd ship2 && ./run-e2e.sh

echo "=== Installing system deps ==="
apt-get update -qq
apt-get install -y -qq docker.io git curl
systemctl start docker

echo "=== Installing Node.js 22 + pnpm ==="
curl -fsSL https://deb.nodesource.com/setup_22.x | bash -
apt-get install -y -qq nodejs
npm i -g pnpm@latest

echo "=== Installing project deps ==="
pnpm install

echo "=== Installing Playwright + Chromium ==="
npx playwright install --with-deps chromium

echo "=== Pre-pulling Postgres ==="
docker pull postgres:15

echo "=== Running 869 E2E tests ==="
npx playwright test --workers=8
