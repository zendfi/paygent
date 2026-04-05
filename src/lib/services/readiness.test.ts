import { beforeEach, describe, expect, it } from "vitest";
import {
  getKpiPostmortemReport,
  getLaunchRecommendation,
  getPilotChecklist,
  runIncidentSimulation,
} from "@/lib/services/readiness";
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

function seededReadyStore(): PaygentStore {
  const now = new Date().toISOString();
  const store = emptyStore();

  for (let i = 1; i <= 3; i += 1) {
    const businessId = `biz_${i}`;
    const supplierId = `sup_${i}`;

    store.businesses.push({
      id: businessId,
      name: `Business ${i}`,
      businessType: "retail",
      ownerPhone: "+2348000000000",
      status: "active",
      pilotStage: "safe_launch",
      createdAt: now,
      updatedAt: now,
    });

    store.subaccounts.push({
      id: `sub_${i}`,
      businessId,
      zendfiSubaccountId: `zend_sub_${i}`,
      walletAddress: `wallet_${i}`,
      status: "active",
      createdAt: now,
      updatedAt: now,
    });

    store.suppliers.push({
      id: supplierId,
      businessId,
      supplierName: `Supplier ${i}`,
      bankId: "OPAY",
      accountNumber: `000000000${i}`,
      accountName: `Supplier ${i}`,
      enabled: true,
      createdAt: now,
      updatedAt: now,
    });

    store.policyVersions.push({
      id: `pol_${i}`,
      businessId,
      status: "active",
      maxPerTxNgn: 50000,
      dailyCapNgn: 200000,
      approvalThresholdNgn: 30000,
      activeDaysUtc: [0, 1, 2, 3, 4, 5, 6],
      activeStartTimeUtc: "00:00",
      activeEndTimeUtc: "23:59",
      createdAt: now,
      activatedAt: now,
    });

    store.pilotModes.push({
      businessId,
      mode: "assisted",
      maxAutoExecutions: 3,
      autoExecutedCount: 0,
      updatedAt: now,
    });
  }

  store.payoutExecutions.push({
    id: "exec_ok",
    intentId: "pi_1",
    businessId: "biz_1",
    supplierId: "sup_1",
    status: "completed",
    createdAt: new Date(Date.now() - 5_000).toISOString(),
    updatedAt: now,
  });

  store.webhookInbox.push({
    id: "wh_ok",
    provider: "zendfi",
    eventId: "evt_ok",
    eventType: "WithdrawalCompleted",
    signature: "sig",
    status: "processed",
    receivedAt: now,
    processedAt: now,
    payload: {},
  });

  return store;
}

describe("week8 readiness", () => {
  beforeEach(async () => {
    await writeStore(seededReadyStore());
  });

  it("returns ready checklist when pilot conditions are met", async () => {
    const checklist = await getPilotChecklist(3);

    expect(checklist.status).toBe("ready");
    expect(checklist.failed).toBe(0);
    expect(checklist.activePilotBusinessIds.length).toBe(3);
  });

  it("runs incident simulation and reports status", async () => {
    const simulation = await runIncidentSimulation({ scenario: "webhook_outage" });

    expect(["pass", "attention_required"]).toContain(simulation.status);
    expect(simulation.timeline.length).toBeGreaterThan(0);
  });

  it("returns KPI report with postmortem template", async () => {
    const report = await getKpiPostmortemReport();

    expect(report.kpis.activePilotBusinesses).toBeGreaterThanOrEqual(3);
    expect(report.postmortemTemplate.timeline).toContain("Detection");
  });

  it("returns a launch recommendation result", async () => {
    const recommendation = await getLaunchRecommendation();

    expect(["launch_go", "conditional_go", "no_go"]).toContain(
      recommendation.recommendation,
    );
    expect(recommendation.nextActions.length).toBeGreaterThan(0);
  });
});
