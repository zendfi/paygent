import { beforeEach, describe, expect, it } from "vitest";
import { getMetricsDashboard, getSlaSummary } from "@/lib/services/metrics-sla";
import { writeStore } from "@/lib/storage/store";
import type { PaygentStore } from "@/lib/storage/types";

function emptyStore(): PaygentStore {
  return {
    businesses: [],
    subaccounts: [],
    suppliers: [],
    policyVersions: [],
    dailySpendCounters: [],
    payoutIntents: [],
    payoutExecutions: [],
    activityEvents: [],
    webhookInbox: [],
    retryJobs: [],
    ownerNotifications: [],
    pilotModes: [],
    aiCommands: [],
    alerts: [],
    credentialRotations: [],
  };
}

describe("metrics and sla", () => {
  beforeEach(async () => {
    const now = new Date();
    const past = new Date(now.getTime() - 10_000).toISOString();
    const store = emptyStore();

    store.businesses.push({
      id: "biz_1",
      name: "Demo",
      businessType: "retail",
      ownerPhone: "+2348000000000",
      status: "active",
      pilotStage: "safe_launch",
      createdAt: now.toISOString(),
      updatedAt: now.toISOString(),
    });

    store.payoutExecutions.push(
      {
        id: "exec_ok",
        intentId: "pi_1",
        businessId: "biz_1",
        supplierId: "sup_1",
        status: "completed",
        createdAt: past,
        updatedAt: now.toISOString(),
      },
      {
        id: "exec_fail",
        intentId: "pi_2",
        businessId: "biz_1",
        supplierId: "sup_1",
        status: "failed",
        createdAt: past,
        updatedAt: now.toISOString(),
      },
    );

    store.webhookInbox.push(
      {
        id: "wh_1",
        provider: "zendfi",
        eventId: "evt_1",
        eventType: "WithdrawalCompleted",
        signature: "sig",
        status: "processed",
        receivedAt: now.toISOString(),
        processedAt: now.toISOString(),
        payload: {},
      },
      {
        id: "wh_2",
        provider: "zendfi",
        eventId: "evt_2",
        eventType: "Unknown",
        signature: "sig",
        status: "ignored",
        receivedAt: now.toISOString(),
        processedAt: now.toISOString(),
        payload: {},
      },
    );

    await writeStore(store);
  });

  it("returns aggregate metrics", async () => {
    const metrics = await getMetricsDashboard();

    expect(metrics.totals.businesses).toBe(1);
    expect(metrics.totals.executions).toBe(2);
    expect(metrics.rates.executionSuccessRatePct).toBe(50);
    expect(metrics.rates.webhookProcessingRatePct).toBe(50);
    expect(metrics.latencies.finalizationP95Ms).toBeGreaterThanOrEqual(0);
  });

  it("returns SLA summary status and checks", async () => {
    const sla = await getSlaSummary();

    expect(["healthy", "degraded", "critical"]).toContain(sla.status);
    expect(sla.checks.length).toBe(3);
  });
});
