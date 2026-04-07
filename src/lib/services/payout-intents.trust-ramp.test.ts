import { beforeEach, describe, expect, it } from "vitest";
import { createAndEvaluatePayoutIntent } from "@/lib/services/payout-intents";
import { updatePilotMode } from "@/lib/services/pilot";
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

describe("trust-ramp threshold gating", () => {
  beforeEach(async () => {
    process.env.PAYGENT_TRUST_RAMP_APPROVAL_THRESHOLD_NGN = "15000";

    const timestamp = new Date().toISOString();
    const store = emptyStore();

    store.businesses.push({
      id: "biz_1",
      name: "Demo Biz",
      businessType: "retail",
      ownerPhone: "+2348000000000",
      status: "active",
      pilotStage: "live",
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

    await updatePilotMode({
      businessId: "biz_1",
      mode: "autonomous",
      maxAutoExecutions: 10,
    });
  });

  it("requires approval when amount crosses trust-ramp threshold", async () => {
    const result = await createAndEvaluatePayoutIntent({
      businessId: "biz_1",
      supplierId: "sup_1",
      amountNgn: 20000,
      reason: "Restock",
      source: "dashboard_action",
      idempotencyKey: "idem_threshold",
    });

    expect(result.intent.status).toBe("approval_required");
    expect(result.intent.decision.reasonCodes).toContain("trust_ramp_threshold");
  });
});
