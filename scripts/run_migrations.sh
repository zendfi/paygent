#!/usr/bin/env bash
set -euo pipefail

if [[ -z "${DATABASE_URL:-}" ]]; then
  echo "DATABASE_URL is required"
  exit 1
fi

psql "$DATABASE_URL" -f migrations/0001_paygent_mvp.sql
psql "$DATABASE_URL" -f migrations/0002_paygent_extended_parity.sql
psql "$DATABASE_URL" -f migrations/0003_paygent_store_state.sql

echo "Migrations applied successfully."
