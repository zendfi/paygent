import { beforeEach, describe, expect, it } from "vitest";
import { evaluateOperationalAlerts, listAlerts } from "@/lib/services/alerts";
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

describe("operational alerts", () => {
  beforeEach(async () => {
    const now = new Date().toISOString();
    const store = emptyStore();

    store.retryJobs.push({
      id: "retry_1",
      intentId: "pi_1",
      businessId: "biz_1",
      attempt: 3,
      maxAttempts: 3,
      status: "exhausted",
      nextRunAt: now,
      createdAt: now,
      updatedAt: now,
    });

    store.webhookInbox.push(
      {
        id: "wh_1",
        provider: "zendfi",
        eventId: "evt_1",
        eventType: "Unknown",
        signature: "sig",
        status: "ignored",
        receivedAt: now,
        processedAt: now,
        payload: {},
      },
      {
        id: "wh_2",
        provider: "zendfi",
        eventId: "evt_2",
        eventType: "Unknown",
        signature: "sig",
        status: "invalid_signature",
        receivedAt: now,
        processedAt: now,
        payload: {},
      },
      {
        id: "wh_3",
        provider: "zendfi",
        eventId: "evt_3",
        eventType: "Unknown",
        signature: "sig",
        status: "ignored",
        receivedAt: now,
        processedAt: now,
        payload: {},
      },
    );

    await writeStore(store);
  });

  it("creates persisted alerts from operational signals", async () => {
    const result = await evaluateOperationalAlerts();

    expect(result.alerts.length).toBeGreaterThan(0);

    const alerts = await listAlerts();
    expect(alerts.length).toBeGreaterThanOrEqual(result.alerts.length);
    expect(alerts[0]?.status).toBe("open");
  });
});
