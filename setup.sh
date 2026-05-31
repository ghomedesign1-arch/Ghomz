#!/usr/bin/env bash
# G-Homz · local bootstrap.
#
# Brings up Postgres (via Docker), installs deps, applies the Prisma schema,
# seeds demo data, and launches the dev server. Safe to re-run.

set -euo pipefail
cd "$(dirname "$0")"

step() { printf "\n\033[1;33m▶ %s\033[0m\n" "$1"; }
ok()   { printf "\033[1;32m✓ %s\033[0m\n" "$1"; }
err()  { printf "\033[1;31m✗ %s\033[0m\n" "$1" >&2; }

# ── 1. Prerequisites ──────────────────────────────────────────────────────
step "Checking prerequisites"

need() {
  command -v "$1" >/dev/null 2>&1 || {
    err "Missing: $1"
    echo "   $2"
    exit 1
  }
  ok "$1 found"
}

need node   "Install Node.js 18+ — https://nodejs.org (or 'brew install node')"
need npm    "npm ships with Node — reinstall Node"
need docker "Install Docker Desktop — https://docker.com (or 'brew install --cask docker')"

# ── 2. .env ──────────────────────────────────────────────────────────────
step "Preparing .env"
if [ ! -f .env ]; then
  cp .env.example .env
  # Generate AUTH_SECRET if openssl is available.
  if command -v openssl >/dev/null 2>&1; then
    secret=$(openssl rand -base64 32)
    # Replace AUTH_SECRET line on macOS (BSD sed) and Linux (GNU sed).
    if sed --version >/dev/null 2>&1; then
      sed -i "s|^AUTH_SECRET=.*|AUTH_SECRET=\"$secret\"|" .env
    else
      sed -i "" "s|^AUTH_SECRET=.*|AUTH_SECRET=\"$secret\"|" .env
    fi
    ok "Generated AUTH_SECRET"
  else
    echo "   ⚠  openssl missing — set AUTH_SECRET manually in .env"
  fi
  ok "Wrote .env from .env.example"
else
  ok ".env already exists (skipping)"
fi

# ── 3. Postgres ──────────────────────────────────────────────────────────
step "Starting Postgres (Docker)"
docker compose up -d postgres

echo "   Waiting for Postgres to accept connections…"
for i in $(seq 1 30); do
  if docker compose exec -T postgres pg_isready -U postgres -d ghomz >/dev/null 2>&1; then
    ok "Postgres is ready"
    break
  fi
  sleep 1
  if [ "$i" -eq 30 ]; then
    err "Postgres didn't come up in 30s — check 'docker compose logs postgres'"
    exit 1
  fi
done

# ── 4. Dependencies ──────────────────────────────────────────────────────
step "Installing npm dependencies"
if [ -d node_modules ]; then
  ok "node_modules present (skipping — delete it to force a clean install)"
else
  npm install
fi

# ── 5. Schema + seed ─────────────────────────────────────────────────────
step "Applying Prisma schema"
npm run db:push

step "Seeding demo data"
npm run db:seed

# ── 6. Launch ────────────────────────────────────────────────────────────
step "Starting the dev server"
echo "   Open http://localhost:3000"
echo "   Sign in with founder@g-homz.com  /  changeme123"
echo "   (Press Ctrl+C to stop)"
echo
npm run dev
