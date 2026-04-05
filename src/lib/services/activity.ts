import { readStore, writeStore } from "@/lib/storage/store";
import type { ActivityEvent } from "@/lib/storage/types";

function makeId(prefix: string): string {
  return `${prefix}_${crypto.randomUUID().replaceAll("-", "").slice(0, 16)}`;
}

function nowIso(): string {
  return new Date().toISOString();
}

export async function addActivityEvent(input: {
  businessId: string;
  type: ActivityEvent["type"];
  message: string;
  metadata?: Record<string, unknown>;
}): Promise<ActivityEvent> {
  const store = await readStore();
  const event: ActivityEvent = {
    id: makeId("evt"),
    businessId: input.businessId,
    type: input.type,
    message: input.message,
    metadata: input.metadata ?? {},
    createdAt: nowIso(),
  };

  store.activityEvents.push(event);
  await writeStore(store);

  return event;
}

export async function listActivityEvents(
  businessId: string,
  limit: number = 50,
): Promise<ActivityEvent[]> {
  const store = await readStore();
  return store.activityEvents
    .filter((event) => event.businessId === businessId)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    .slice(0, Math.max(1, limit));
}
