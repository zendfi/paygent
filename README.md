# Paygent

Paygent is a Next.js monolith for AI-assisted supplier payouts for Nigerian SMEs, built on ZendFi primitives.

## Local Setup

1. Install dependencies:

```bash
npm install
```

2. Create environment file:

```bash
cp .env.example .env.local
```

3. Run development server:

```bash
npm run dev
```

4. Open `http://localhost:3000`.

## Project Layout

- `src/app` - UI and route handlers
- `src/lib` - domain services (policy, audit, provider clients)
- `migrations` - SQL schema versions
- `docs` - execution blueprint and implementation checklists

## Key References

- `docs/EXECUTION_BLUEPRINT.md`
- `docs/IMPLEMENTATION_CHECKLIST.md`
- `docs/API_CONTRACTS.md`
- `docs/DB_ROLLOUT.md`
- `docs/DEPLOY_CHECKLIST.md`
- `migrations/0001_paygent_mvp.sql`

## Storage Backends

- Default: `PAYGENT_STORAGE_BACKEND=file` (local development)
- Production-ready: `PAYGENT_STORAGE_BACKEND=postgres` with `DATABASE_URL`

When using Postgres mode, apply migrations from `migrations/0001_paygent_mvp.sql` through
`migrations/0003_paygent_store_state.sql`.

Quick migration command:

```bash
npm run db:migrate
```

## Security Notes

- Do not commit live API keys.
- Keep `ZENDFI_API_KEY` and `GEMINI_API_KEY` in secret storage.
- Rotate keys immediately if exposed in logs or chat.
