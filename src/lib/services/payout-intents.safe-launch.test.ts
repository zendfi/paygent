import { beforeEach, describe, expect, it } from "vitest";
import { createAndEvaluatePayoutIntent } from "@/lib/services/payout-intents";
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

describe("safe-launch payout gating", () => {
  beforeEach(async () => {
    const timestamp = new Date().toISOString();
    const store = emptyStore();

    store.businesses.push({
      id: "biz_1",
      name: "Demo Biz",
      businessType: "retail",
      ownerPhone: "+2348000000000",
      status: "active",
      pilotStage: "safe_launch",
      createdAt: timestamp,
      updatedAt: timestamp,
    });

    store.suppliers.push({
      id: "sup_1",
      businessId: "biz_1",
      supplierName: "Supplier",
      bankId: "OPAY",
      accountNumber: "0123456789",
      accountName: "Supplier Name",
      enabled: true,
      createdAt: timestamp,
      updatedAt: timestamp,
    });

    store.policyVersions.push({
      id: "pol_1",
      businessId: "biz_1",
      status: "active",
      maxPerTxNgn: 50000,
      dailyCapNgn: 200000,
      approvalThresholdNgn: 30000,
      activeDaysUtc: [0, 1, 2, 3, 4, 5, 6],
      activeStartTimeUtc: "00:00",
      activeEndTimeUtc: "23:59",
      createdAt: timestamp,
      activatedAt: timestamp,
    });

    await writeStore(store);
  });

  it("forces approval_required in assisted safe-launch for otherwise queued intents", async () => {
    const result = await createAndEvaluatePayoutIntent({
      businessId: "biz_1",
      supplierId: "sup_1",
      amountNgn: 10000,
      reason: "Stock",
      source: "owner_command",
      idempotencyKey: "idem_1",
    });

    expect(result.intent.status).toBe("approval_required");
    expect(result.intent.decision.reasonCodes).toContain("safe_launch_control");
  });
});
