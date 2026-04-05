import { readStore, writeStore } from "@/lib/storage/store";
import type { CredentialRotationRecord } from "@/lib/storage/types";

function makeId(prefix: string): string {
  return `${prefix}_${crypto.randomUUID().replaceAll("-", "").slice(0, 16)}`;
}

function nowIso(): string {
  return new Date().toISOString();
}

function plusDays(days: number): string {
  return new Date(Date.now() + days * 24 * 60 * 60 * 1000).toISOString();
}

export async function listCredentialRotations(limit = 100): Promise<CredentialRotationRecord[]> {
  const store = await readStore();
  return store.credentialRotations
    .slice()
    .sort((a, b) => b.requestedAt.localeCompare(a.requestedAt))
    .slice(0, limit);
}

export async function requestCredentialRotation(input: {
  credentialType: CredentialRotationRecord["credentialType"];
  requestedBy: string;
  reason: string;
}): Promise<CredentialRotationRecord> {
  const timestamp = nowIso();
  const record: CredentialRotationRecord = {
    id: makeId("rot"),
    credentialType: input.credentialType,
    status: "pending",
    requestedBy: input.requestedBy,
    reason: input.reason,
    requestedAt: timestamp,
  };

  const store = await readStore();
  store.credentialRotations.push(record);
  await writeStore(store);
  return record;
}

export async function completeCredentialRotation(input: {
  rotationId: string;
  notes?: string;
}): Promise<CredentialRotationRecord> {
  const store = await readStore();
  const record = store.credentialRotations.find((item) => item.id === input.rotationId);
  if (!record) {
    throw new Error("rotation_not_found");
  }

  record.status = "completed";
  record.completedAt = nowIso();
  record.nextDueAt = plusDays(30);
  record.notes = input.notes;
  await writeStore(store);
  return record;
}
