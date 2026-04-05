import { Pool } from "pg";
import { EMPTY_STORE, normalizeStore } from "@/lib/storage/normalize";
import type { PaygentStore } from "@/lib/storage/types";

const STATE_TABLE_SQL = `
create table if not exists paygent_store_state (
  id text primary key,
  payload jsonb not null,
  updated_at timestamptz not null default now()
);
`;

let pool: Pool | null = null;
let ensuredSchema = false;

function getPool(): Pool {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error("DATABASE_URL is required for postgres storage backend");
  }

  if (!pool) {
    pool = new Pool({ connectionString });
  }

  return pool;
}

async function ensureSchema(): Promise<void> {
  if (ensuredSchema) {
    return;
  }

  const db = getPool();
  await db.query(STATE_TABLE_SQL);
  ensuredSchema = true;
}

export async function readPostgresStore(): Promise<PaygentStore> {
  await ensureSchema();
  const db = getPool();

  const existing = await db.query<{ payload: PaygentStore }>(
    "select payload from paygent_store_state where id = $1 limit 1",
    ["default"],
  );

  if (existing.rows.length === 0) {
    await db.query(
      "insert into paygent_store_state (id, payload) values ($1, $2::jsonb)",
      ["default", JSON.stringify(EMPTY_STORE)],
    );
    return EMPTY_STORE;
  }

  const payload = existing.rows[0]?.payload;
  if (!payload || typeof payload !== "object") {
    return EMPTY_STORE;
  }

  return normalizeStore(payload as Partial<PaygentStore>);
}

export async function writePostgresStore(nextStore: PaygentStore): Promise<void> {
  await ensureSchema();
  const db = getPool();

  await db.query(
    `
    insert into paygent_store_state (id, payload, updated_at)
    values ($1, $2::jsonb, now())
    on conflict (id)
    do update set payload = excluded.payload, updated_at = now()
    `,
    ["default", JSON.stringify(nextStore)],
  );
}

export async function getPostgresHealth(): Promise<{
  ok: boolean;
  stateTablePresent: boolean;
  checkedAt: string;
  error?: string;
}> {
  try {
    const db = getPool();
    await db.query("select 1");

    const result = await db.query<{ exists: string | null }>(
      "select to_regclass('public.paygent_store_state') as exists",
    );

    return {
      ok: true,
      stateTablePresent: Boolean(result.rows[0]?.exists),
      checkedAt: new Date().toISOString(),
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : "postgres_unavailable";
    return {
      ok: false,
      stateTablePresent: false,
      checkedAt: new Date().toISOString(),
      error: message,
    };
  }
}
