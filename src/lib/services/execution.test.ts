import { beforeEach, describe, expect, it, vi } from "vitest";
import { executePayoutIntent, reconcileStaleExecutions } from "@/lib/services/execution";
import { readStore, writeStore } from "@/lib/storage/store";
import type { PaygentStore } from "@/lib/storage/types";

const mockWithdrawSubaccountToBank = vi.fn();
const mockGetWithdrawalStatus = vi.fn();
const mockCreateSigningGrant = vi.fn();

vi.mock("@/lib/zendfi/client", async () => {
  return {
    withdrawSubaccountToBank: (...args: unknown[]) =>
      mockWithdrawSubaccountToBank(...args),
    getWithdrawalStatus: (...args: unknown[]) => mockGetWithdrawalStatus(...args),
    createSigningGrant: (...args: unknown[]) => mockCreateSigningGrant(...args),
  };
});

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

function seedBaseStore(): PaygentStore {
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

  store.subaccounts.push({
    id: "sub_1",
    businessId: "biz_1",
    zendfiSubaccountId: "zend_sub_1",
    walletAddress: "wallet_1",
    status: "active",
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

  store.payoutIntents.push({
    id: "pi_1",
    businessId: "biz_1",
    supplierId: "sup_1",
    source: "dashboard_action",
    amountNgn: 10000,
    reason: "Test",
    idempotencyKey: "idem_1",
    status: "approved",
    decision: {
      allowed: true,
      requiresApproval: false,
      reasonCodes: [],
    },
    createdAt: timestamp,
    updatedAt: timestamp,
  });

  return store;
}

describe("execution week 5 reliability", () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    mockCreateSigningGrant.mockResolvedValue({
      id: "ssgt_test_1",
      expiresAt: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
    });
    await writeStore(seedBaseStore());
  });

  it("schedules retry on transient execution failure", async () => {
    mockWithdrawSubaccountToBank.mockRejectedValueOnce(new Error("network timeout"));

    await expect(executePayoutIntent("pi_1")).rejects.toThrow("network timeout");

    const store = await readStore();
    expect(store.retryJobs).toHaveLength(1);
    expect(store.retryJobs[0]?.status).toBe("scheduled");
    expect(store.retryJobs[0]?.attempt).toBe(1);

    const intent = store.payoutIntents.find((item) => item.id === "pi_1");
    expect(intent?.status).toBe("approved");
  });

  it("exhausts retries and marks intent failed when budget exceeded", async () => {
    const store = seedBaseStore();
    const timestamp = new Date().toISOString();

    store.retryJobs.push(
      {
        id: "retry_1",
        intentId: "pi_1",
        businessId: "biz_1",
        attempt: 1,
        maxAttempts: 3,
        status: "scheduled",
        nextRunAt: timestamp,
        createdAt: timestamp,
        updatedAt: timestamp,
      },
      {
        id: "retry_2",
        intentId: "pi_1",
        businessId: "biz_1",
        attempt: 2,
        maxAttempts: 3,
        status: "scheduled",
        nextRunAt: timestamp,
        createdAt: timestamp,
        updatedAt: timestamp,
      },
      {
        id: "retry_3",
        intentId: "pi_1",
        businessId: "biz_1",
        attempt: 3,
        maxAttempts: 3,
        status: "scheduled",
        nextRunAt: timestamp,
        createdAt: timestamp,
        updatedAt: timestamp,
      },
    );

    await writeStore(store);
    mockWithdrawSubaccountToBank.mockRejectedValueOnce(new Error("network timeout"));

    await expect(executePayoutIntent("pi_1")).rejects.toThrow("network timeout");

    const after = await readStore();
    const exhausted = after.retryJobs.find((job) => job.status === "exhausted");
    expect(exhausted).toBeTruthy();

    const intent = after.payoutIntents.find((item) => item.id === "pi_1");
    expect(intent?.status).toBe("failed");
  });

  it("reconciles stale pending executions from provider status", async () => {
    const store = seedBaseStore();
    const old = new Date(Date.now() - 10 * 60_000).toISOString();

    store.payoutIntents[0]!.status = "executing";
    store.payoutExecutions.push({
      id: "exec_1",
      intentId: "pi_1",
      businessId: "biz_1",
      supplierId: "sup_1",
      status: "pending_webhook",
      providerOrderId: "order_123",
      createdAt: old,
      updatedAt: old,
    });

    await writeStore(store);

    mockGetWithdrawalStatus.mockResolvedValueOnce({
      status: "completed",
      transactionSignature: "tx_123",
    });

    const result = await reconcileStaleExecutions({ staleAfterMinutes: 0, limit: 10 });

    expect(result.scanned).toBe(1);
    expect(result.resolved).toBe(1);
    expect(result.unresolved).toBe(0);

    const after = await readStore();
    const execution = after.payoutExecutions.find((item) => item.id === "exec_1");
    const intent = after.payoutIntents.find((item) => item.id === "pi_1");

    expect(execution?.status).toBe("completed");
    expect(execution?.transactionSignature).toBe("tx_123");
    expect(intent?.status).toBe("completed");
    expect(after.ownerNotifications.length).toBeGreaterThan(0);
  });
});
