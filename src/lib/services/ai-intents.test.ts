import { beforeEach, describe, expect, it } from "vitest";
import { parseOwnerCommandToIntent } from "@/lib/services/ai-intents";
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

function seedStore(): PaygentStore {
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
    supplierName: "Alhaji Musa",
    bankId: "OPAY",
    accountNumber: "0123456789",
    accountName: "Musa Farms",
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

  store.dailySpendCounters.push({
    businessId: "biz_1",
    usageDate: timestamp.slice(0, 10),
    spentNgn: 0,
    updatedAt: timestamp,
  });

  return store;
}

describe("AI intent parsing", () => {
  beforeEach(async () => {
    process.env.GEMINI_API_KEY = "";
    await writeStore(seedStore());
  });

  it("returns needs_approval in safe-launch assisted mode", async () => {
    const result = await parseOwnerCommandToIntent({
      businessId: "biz_1",
      command: "Pay Alhaji Musa NGN 15000 for tomatoes",
    });

    expect(result.parsed.supplierId).toBe("sup_1");
    expect(result.parsed.amountNgn).toBe(15000);
    expect(result.decision.action).toBe("needs_approval");
  });

  it("returns execute when autonomous mode and under limits", async () => {
    await updatePilotMode({
      businessId: "biz_1",
      mode: "autonomous",
      maxAutoExecutions: 5,
    });

    const result = await parseOwnerCommandToIntent({
      businessId: "biz_1",
      command: "Send 12000 to Alhaji Musa now",
    });

    expect(result.decision.action).toBe("execute");
  });

  it("matches supplier using partial name tokens", async () => {
    await updatePilotMode({
      businessId: "biz_1",
      mode: "autonomous",
      maxAutoExecutions: 5,
    });

    const result = await parseOwnerCommandToIntent({
      businessId: "biz_1",
      command: "Pay Musa NGN 1500 for tomatoes",
    });

    expect(result.parsed.supplierId).toBe("sup_1");
    expect(result.parsed.amountNgn).toBe(1500);
    expect(result.decision.action).toBe("execute");
  });
});
