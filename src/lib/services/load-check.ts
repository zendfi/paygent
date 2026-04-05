import { evaluatePolicy } from "@/lib/policies/engine";
import { readStore } from "@/lib/storage/store";

function percentile(values: number[], p: number): number {
  if (values.length === 0) {
    return 0;
  }
  const sorted = [...values].sort((a, b) => a - b);
  const index = Math.min(sorted.length - 1, Math.floor((p / 100) * sorted.length));
  return sorted[index] ?? 0;
}

export async function runLoadCheck(input?: {
  iterations?: number;
}): Promise<{
  iterations: number;
  durationMs: number;
  readStoreP95Ms: number;
  policyEvalP95Ms: number;
  totalBusinesses: number;
  totalPayoutIntents: number;
}> {
  const iterations = Math.max(10, Math.min(input?.iterations ?? 120, 500));

  const readStoreDurations: number[] = [];
  const policyDurations: number[] = [];
  const start = Date.now();

  for (let i = 0; i < iterations; i += 1) {
    const readStart = performance.now();
    const store = await readStore();
    readStoreDurations.push(performance.now() - readStart);

    const evalStart = performance.now();
    evaluatePolicy({
      amountNgn: 10000,
      spentTodayNgn: i * 50,
      nowUtc: new Date(),
      policy: {
        maxPerTxNgn: 30000,
        dailyCapNgn: 150000,
        approvalThresholdNgn: 30000,
        activeDaysUtc: [0, 1, 2, 3, 4, 5, 6],
        activeStartTimeUtc: "00:00",
        activeEndTimeUtc: "23:59",
      },
      isSupplierWhitelisted: true,
      isBusinessFrozen: false,
      hasSufficientBalance: true,
    });
    policyDurations.push(performance.now() - evalStart);

    if (i === iterations - 1) {
      return {
        iterations,
        durationMs: Date.now() - start,
        readStoreP95Ms: Number(percentile(readStoreDurations, 95).toFixed(3)),
        policyEvalP95Ms: Number(percentile(policyDurations, 95).toFixed(3)),
        totalBusinesses: store.businesses.length,
        totalPayoutIntents: store.payoutIntents.length,
      };
    }
  }

  return {
    iterations,
    durationMs: Date.now() - start,
    readStoreP95Ms: 0,
    policyEvalP95Ms: 0,
    totalBusinesses: 0,
    totalPayoutIntents: 0,
  };
}
