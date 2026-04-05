import { readStore, writeStore } from "@/lib/storage/store";
import type { DailySpendCounter } from "@/lib/storage/types";

function todayUtcDateKey(now: Date): string {
  return now.toISOString().slice(0, 10);
}

function nowIso(): string {
  return new Date().toISOString();
}

function getOrCreateCounter(
  counters: DailySpendCounter[],
  businessId: string,
  usageDate: string,
): DailySpendCounter {
  const existing = counters.find(
    (counter) => counter.businessId === businessId && counter.usageDate === usageDate,
  );

  if (existing) {
    return existing;
  }

  const created: DailySpendCounter = {
    businessId,
    usageDate,
    spentNgn: 0,
    updatedAt: nowIso(),
  };
  counters.push(created);
  return created;
}

export async function getTodaySpentNgn(
  businessId: string,
  now: Date = new Date(),
): Promise<number> {
  const store = await readStore();
  const usageDate = todayUtcDateKey(now);
  const counter = store.dailySpendCounters.find(
    (entry) => entry.businessId === businessId && entry.usageDate === usageDate,
  );
  return counter?.spentNgn ?? 0;
}

export async function incrementTodaySpentNgn(
  businessId: string,
  amountNgn: number,
  now: Date = new Date(),
): Promise<DailySpendCounter> {
  if (amountNgn <= 0) {
    throw new Error("invalid_increment_amount");
  }

  const store = await readStore();
  const usageDate = todayUtcDateKey(now);
  const counter = getOrCreateCounter(store.dailySpendCounters, businessId, usageDate);

  counter.spentNgn += amountNgn;
  counter.updatedAt = nowIso();

  await writeStore(store);
  return counter;
}
