import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { EMPTY_STORE, normalizeStore } from "@/lib/storage/normalize";
import { readPostgresStore, writePostgresStore } from "@/lib/storage/postgres";
import type { PaygentStore } from "@/lib/storage/types";

const STORE_DIRECTORY = path.join(process.cwd(), "data");
const STORE_FILE = path.join(STORE_DIRECTORY, "dev-store.json");

function isPostgresBackendEnabled(): boolean {
  return process.env.PAYGENT_STORAGE_BACKEND === "postgres";
}

async function ensureStoreFileExists(): Promise<void> {
  await mkdir(STORE_DIRECTORY, { recursive: true });

  try {
    await readFile(STORE_FILE, "utf8");
  } catch {
    await writeFile(STORE_FILE, JSON.stringify(EMPTY_STORE, null, 2), "utf8");
  }
}

export async function readStore(): Promise<PaygentStore> {
  if (isPostgresBackendEnabled()) {
    return readPostgresStore();
  }

  await ensureStoreFileExists();
  const raw = await readFile(STORE_FILE, "utf8");

  try {
    const parsed = JSON.parse(raw) as Partial<PaygentStore>;
    return normalizeStore(parsed);
  } catch {
    await writeStore(EMPTY_STORE);
    return EMPTY_STORE;
  }
}

export async function writeStore(nextStore: PaygentStore): Promise<void> {
  if (isPostgresBackendEnabled()) {
    await writePostgresStore(nextStore);
    return;
  }

  await ensureStoreFileExists();
  await writeFile(STORE_FILE, JSON.stringify(nextStore, null, 2), "utf8");
}
