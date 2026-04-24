#!/bin/bash
set -euo pipefail

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

info()  { printf "${GREEN}[+]${NC} %s\n" "$1"; }
warn()  { printf "${YELLOW}[!]${NC} %s\n" "$1"; }
error() { printf "${RED}[x]${NC} %s\n" "$1"; exit 1; }

if [ -f .env ]; then
    error ".env already exists. Delete it and your postgres volume to start fresh."
fi

command -v openssl >/dev/null 2>&1 || error "openssl is required but not installed."

info "Generating secrets..."

cat > .env <<EOF
POSTGRES_PASSWORD=$(openssl rand -hex 32)
JWT_SECRET=$(openssl rand -hex 64)
AUTH_ADMIN_PASSWORD=$(openssl rand -hex 32)
AUTHENTICATOR_PASSWORD=$(openssl rand -hex 32)
SERVICE_WORKER_PASSWORD=$(openssl rand -hex 32)
SITE_URL=http://localhost:8080
ALPACA_KEY_ID=XXXXXXXXXXXXXXXXXXXXXXXXXX
ALPACA_SECRET_KEY=XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX
EOF

info "Done!"
warn "Edit SITE_URL and Alpaca Secrets in .env before deploying to production."
warn "Run 'docker compose up -d' to start."
