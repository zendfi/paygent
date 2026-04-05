import { createHmac } from "node:crypto";
import { beforeEach, describe, expect, it } from "vitest";
import { processZendfiWebhook } from "@/lib/services/webhooks";
import { readStore, writeStore } from "@/lib/storage/store";
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

function signPayload(rawBody: string, secret: string, timestamp: number): string {
  const signedPayload = `${timestamp}.${rawBody}`;
  const digest = createHmac("sha256", Buffer.from(secret, "utf8"))
    .update(signedPayload)
    .digest("hex");
  return `t=${timestamp},v1=${digest}`;
}

describe("processZendfiWebhook", () => {
  beforeEach(async () => {
    process.env.ZENDFI_WEBHOOK_SECRET = "testsecret";
    process.env.ZENDFI_WEBHOOK_TOLERANCE_SECONDS = "300";

    const store = emptyStore();
    store.businesses.push({
      id: "biz_1",
      name: "Demo Biz",
      businessType: "retail",
      ownerPhone: "+2348000000000",
      status: "active",
      pilotStage: "safe_launch",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });

    store.payoutIntents.push({
      id: "pi_1",
      businessId: "biz_1",
      supplierId: "sup_1",
      source: "dashboard_action",
      amountNgn: 20000,
      idempotencyKey: "idem_1",
      status: "executing",
      decision: {
        allowed: true,
        requiresApproval: false,
        reasonCodes: [],
      },
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });

    store.payoutExecutions.push({
      id: "exec_1",
      intentId: "pi_1",
      businessId: "biz_1",
      supplierId: "sup_1",
      status: "pending_webhook",
      providerOrderId: "order_123",
      createdAt: new Date(Date.now() - 60_000).toISOString(),
      updatedAt: new Date(Date.now() - 60_000).toISOString(),
    });

    await writeStore(store);
  });

  it("processes valid WithdrawalCompleted webhook and marks execution completed", async () => {
    const payload = {
      event: "WithdrawalCompleted",
      withdrawal: {
        paj_order_id: "order_123",
        transaction_signature: "tx_abc",
      },
    };
    const rawBody = JSON.stringify(payload);
    const ts = Math.floor(Date.now() / 1000);
    const signature = signPayload(rawBody, "testsecret", ts);

    const result = await processZendfiWebhook({
      rawBody,
      signatureHeader: signature,
      headers: new Headers({ "x-zendfi-event-id": "evt_1" }),
    });

    expect(result.ok).toBe(true);
    expect(result.duplicate).toBe(false);
    expect(result.message).toBe("processed");
    expect(result.matchedExecutionId).toBe("exec_1");

    const store = await readStore();
    const execution = store.payoutExecutions.find((item) => item.id === "exec_1");
    const intent = store.payoutIntents.find((item) => item.id === "pi_1");
    expect(execution?.status).toBe("completed");
    expect(execution?.transactionSignature).toBe("tx_abc");
    expect(intent?.status).toBe("completed");
    expect(store.webhookInbox.at(-1)?.status).toBe("processed");
  });

  it("dedupes repeated event ids", async () => {
    const payload = {
      event: "WithdrawalCompleted",
      withdrawal: {
        paj_order_id: "order_123",
      },
    };
    const rawBody = JSON.stringify(payload);
    const ts = Math.floor(Date.now() / 1000);
    const signature = signPayload(rawBody, "testsecret", ts);

    await processZendfiWebhook({
      rawBody,
      signatureHeader: signature,
      headers: new Headers({ "x-zendfi-event-id": "evt_duplicate" }),
    });

    const second = await processZendfiWebhook({
      rawBody,
      signatureHeader: signature,
      headers: new Headers({ "x-zendfi-event-id": "evt_duplicate" }),
    });

    expect(second.ok).toBe(true);
    expect(second.duplicate).toBe(true);
    expect(second.message).toBe("duplicate_ignored");

    const store = await readStore();
    const duplicateEvents = store.webhookInbox.filter((item) => item.eventId === "evt_duplicate");
    expect(duplicateEvents).toHaveLength(2);
    expect(duplicateEvents[1]?.status).toBe("duplicate");
  });

  it("rejects invalid webhook signature", async () => {
    const payload = {
      event: "WithdrawalFailed",
      withdrawal: {
        paj_order_id: "order_123",
      },
    };

    const result = await processZendfiWebhook({
      rawBody: JSON.stringify(payload),
      signatureHeader: "t=1,v1=bad_signature",
      headers: new Headers({ "x-zendfi-event-id": "evt_invalid_sig" }),
    });

    expect(result.ok).toBe(false);
    expect(result.httpStatus).toBe(401);
    expect(result.message).toBe("invalid_signature");

    const store = await readStore();
    expect(store.webhookInbox.at(-1)?.status).toBe("invalid_signature");
  });
});
