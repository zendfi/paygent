import { addActivityEvent } from "@/lib/services/activity";
import { getBusinessById } from "@/lib/services/businesses";
import { readStore, writeStore } from "@/lib/storage/store";
import type { PilotModeRecord } from "@/lib/storage/types";

function nowIso(): string {
  return new Date().toISOString();
}

function defaultPilotMode(businessId: string): PilotModeRecord {
  return {
    businessId,
    mode: "assisted",
    maxAutoExecutions: 3,
    autoExecutedCount: 0,
    updatedAt: nowIso(),
  };
}

export async function getPilotMode(businessId: string): Promise<PilotModeRecord | undefined> {
  const store = await readStore();
  return store.pilotModes.find((record) => record.businessId === businessId);
}

export async function getOrCreatePilotMode(businessId: string): Promise<PilotModeRecord> {
  const existing = await getPilotMode(businessId);
  if (existing) {
    return existing;
  }

  const business = await getBusinessById(businessId);
  if (!business) {
    throw new Error("business_not_found");
  }

  const next = defaultPilotMode(businessId);
  const store = await readStore();
  store.pilotModes.push(next);
  await writeStore(store);
  return next;
}

export async function updatePilotMode(input: {
  businessId: string;
  mode: PilotModeRecord["mode"];
  maxAutoExecutions?: number;
}): Promise<PilotModeRecord> {
  const business = await getBusinessById(input.businessId);
  if (!business) {
    throw new Error("business_not_found");
  }

  const store = await readStore();
  const existing = store.pilotModes.find((record) => record.businessId === input.businessId);

  if (!existing) {
    const created = {
      ...defaultPilotMode(input.businessId),
      mode: input.mode,
      maxAutoExecutions: input.maxAutoExecutions ?? 3,
      updatedAt: nowIso(),
    };
    store.pilotModes.push(created);
    await writeStore(store);

    await addActivityEvent({
      businessId: input.businessId,
      type: "pilot_mode_updated",
      message: `Pilot mode set to ${created.mode}.`,
      metadata: {
        mode: created.mode,
        maxAutoExecutions: created.maxAutoExecutions,
      },
    });

    return created;
  }

  existing.mode = input.mode;
  existing.maxAutoExecutions = input.maxAutoExecutions ?? existing.maxAutoExecutions;
  existing.updatedAt = nowIso();
  await writeStore(store);

  await addActivityEvent({
    businessId: input.businessId,
    type: "pilot_mode_updated",
    message: `Pilot mode updated to ${existing.mode}.`,
    metadata: {
      mode: existing.mode,
      maxAutoExecutions: existing.maxAutoExecutions,
    },
  });

  return existing;
}

export async function incrementAutoExecutedCount(businessId: string): Promise<PilotModeRecord> {
  const store = await readStore();
  const existing = store.pilotModes.find((record) => record.businessId === businessId);

  if (!existing) {
    const created = defaultPilotMode(businessId);
    created.autoExecutedCount = 1;
    store.pilotModes.push(created);
    await writeStore(store);
    return created;
  }

  existing.autoExecutedCount += 1;
  existing.updatedAt = nowIso();
  await writeStore(store);
  return existing;
}
