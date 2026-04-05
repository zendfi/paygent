import { createHmac, createHash, timingSafeEqual } from "node:crypto";
import { getEnv } from "@/lib/config/env";
import { addActivityEvent } from "@/lib/services/activity";
import { applyExecutionOutcomeByProviderOrder } from "@/lib/services/execution";
import { readStore, writeStore } from "@/lib/storage/store";
import type { WebhookInboxRecord } from "@/lib/storage/types";

type WebhookProcessingResult = {
  ok: boolean;
  httpStatus: number;
  duplicate: boolean;
  eventId: string;
  eventType: string;
  matchedExecutionId?: string;
  message: string;
};

export type UnmatchedWebhookReportItem = {
  id: string;
  eventId: string;
  eventType: string;
  status: "invalid_signature" | "ignored";
  receivedAt: string;
  processedAt: string;
};

function makeId(prefix: string): string {
  return `${prefix}_${crypto.randomUUID().replaceAll("-", "").slice(0, 16)}`;
}

function nowIso(): string {
  return new Date().toISOString();
}

function deriveKey(secret: string): Buffer {
  if (secret.startsWith("whsec_")) {
    const raw = secret.slice("whsec_".length);
    return Buffer.from(raw, "hex");
  }
  return Buffer.from(secret, "utf8");
}

function verifyZendfiSignature(rawBody: string, signatureHeader: string, secret: string): boolean {
  const parts = signatureHeader.split(",");
  if (parts.length !== 2) {
    return false;
  }

  const timestampPart = parts.find((part) => part.trim().startsWith("t="));
  const signaturePart = parts.find((part) => part.trim().startsWith("v1="));
  if (!timestampPart || !signaturePart) {
    return false;
  }

  const timestamp = Number(timestampPart.trim().slice(2));
  const provided = signaturePart.trim().slice(3);
  if (!Number.isFinite(timestamp) || !provided) {
    return false;
  }

  const tolerance = getEnv().zendfiWebhookToleranceSeconds;
  const age = Math.floor(Date.now() / 1000) - timestamp;
  if (age > tolerance || age < -60) {
    return false;
  }

  const payload = `${timestamp}.${rawBody}`;
  const expected = createHmac("sha256", deriveKey(secret)).update(payload).digest("hex");

  const expectedBuffer = Buffer.from(expected, "utf8");
  const providedBuffer = Buffer.from(provided, "utf8");
  if (expectedBuffer.length !== providedBuffer.length) {
    return false;
  }

  return timingSafeEqual(expectedBuffer, providedBuffer);
}

function getEventId(rawBody: string, headers: Headers): string {
  const headerEventId =
    headers.get("x-zendfi-event-id") ??
    headers.get("x-zendfi-delivery-id") ??
    headers.get("x-request-id");

  if (headerEventId) {
    return headerEventId;
  }

  return createHash("sha256").update(rawBody).digest("hex");
}

function extractEventType(payload: Record<string, unknown>): string {
  const event = payload.event;
  return typeof event === "string" ? event : "unknown";
}

function extractProviderOrderId(payload: Record<string, unknown>): string | undefined {
  const direct = payload.order_id;
  if (typeof direct === "string" && direct.length > 0) {
    return direct;
  }

  const withdrawal = payload.withdrawal;
  if (withdrawal && typeof withdrawal === "object") {
    const data = withdrawal as Record<string, unknown>;
    const pajOrderId = data.paj_order_id;
    if (typeof pajOrderId === "string" && pajOrderId.length > 0) {
      return pajOrderId;
    }

    const offrampOrderId = data.offramp_order_id;
    if (typeof offrampOrderId === "string" && offrampOrderId.length > 0) {
      return offrampOrderId;
    }
  }

  return undefined;
}

function extractTransactionSignature(payload: Record<string, unknown>): string | undefined {
  const withdrawal = payload.withdrawal;
  if (withdrawal && typeof withdrawal === "object") {
    const data = withdrawal as Record<string, unknown>;
    const signature = data.transaction_signature;
    if (typeof signature === "string" && signature.length > 0) {
      return signature;
    }
  }
  return undefined;
}

function extractFailureReason(payload: Record<string, unknown>): string | undefined {
  const withdrawal = payload.withdrawal;
  if (withdrawal && typeof withdrawal === "object") {
    const data = withdrawal as Record<string, unknown>;
    const failure = data.error_message;
    if (typeof failure === "string" && failure.length > 0) {
      return failure;
    }
  }
  return undefined;
}

async function appendWebhookInboxRecord(record: WebhookInboxRecord): Promise<void> {
  const store = await readStore();
  store.webhookInbox.push(record);
  await writeStore(store);
}

function isUnmatchedWebhookRecord(
  item: WebhookInboxRecord,
): item is WebhookInboxRecord & { status: UnmatchedWebhookReportItem["status"] } {
  return item.status === "invalid_signature" || item.status === "ignored";
}

export async function processZendfiWebhook(input: {
  rawBody: string;
  signatureHeader: string | null;
  headers: Headers;
}): Promise<WebhookProcessingResult> {
  const env = getEnv();
  const eventId = getEventId(input.rawBody, input.headers);

  const payload = JSON.parse(input.rawBody) as Record<string, unknown>;
  const eventType = extractEventType(payload);

  const store = await readStore();
  const duplicate = store.webhookInbox.some((event) => event.eventId === eventId);
  if (duplicate) {
    const duplicateRecord: WebhookInboxRecord = {
      id: makeId("wh"),
      provider: "zendfi",
      eventId,
      eventType,
      signature: input.signatureHeader ?? "",
      status: "duplicate",
      receivedAt: nowIso(),
      processedAt: nowIso(),
      payload,
    };
    await appendWebhookInboxRecord(duplicateRecord);
    return {
      ok: true,
      httpStatus: 200,
      duplicate: true,
      eventId,
      eventType,
      message: "duplicate_ignored",
    };
  }

  const signature = input.signatureHeader ?? "";
  if (!env.zendfiWebhookSecret || !verifyZendfiSignature(input.rawBody, signature, env.zendfiWebhookSecret)) {
    await appendWebhookInboxRecord({
      id: makeId("wh"),
      provider: "zendfi",
      eventId,
      eventType,
      signature,
      status: "invalid_signature",
      receivedAt: nowIso(),
      processedAt: nowIso(),
      payload,
    });
    return {
      ok: false,
      httpStatus: 401,
      duplicate: false,
      eventId,
      eventType,
      message: "invalid_signature",
    };
  }

  const providerOrderId = extractProviderOrderId(payload);
  const normalized = eventType.toLowerCase();
  let matchedExecutionId: string | undefined;

  if (providerOrderId && normalized === "withdrawalcompleted") {
    const updated = await applyExecutionOutcomeByProviderOrder({
      providerOrderId,
      status: "completed",
      transactionSignature: extractTransactionSignature(payload),
      source: "webhook",
      rawEventType: eventType,
    });
    matchedExecutionId = updated?.id;
  } else if (providerOrderId && normalized === "withdrawalfailed") {
    const updated = await applyExecutionOutcomeByProviderOrder({
      providerOrderId,
      status: "failed",
      failureCode: "provider_failed",
      failureReason: extractFailureReason(payload) ?? "withdrawal_failed",
      source: "webhook",
      rawEventType: eventType,
    });
    matchedExecutionId = updated?.id;
  }

  await appendWebhookInboxRecord({
    id: makeId("wh"),
    provider: "zendfi",
    eventId,
    eventType,
    signature,
    status: matchedExecutionId ? "processed" : "ignored",
    executionId: matchedExecutionId,
    receivedAt: nowIso(),
    processedAt: nowIso(),
    payload,
  });

  if (matchedExecutionId) {
    const storeAfter = await readStore();
    const execution = storeAfter.payoutExecutions.find((entry) => entry.id === matchedExecutionId);
    if (execution) {
      await addActivityEvent({
        businessId: execution.businessId,
        type: "webhook_processed",
        message: `Webhook ${eventType} processed for execution ${matchedExecutionId}.`,
        metadata: {
          eventId,
          eventType,
          providerOrderId,
          executionId: matchedExecutionId,
        },
      });
    }
  }

  return {
    ok: true,
    httpStatus: 200,
    duplicate: false,
    eventId,
    eventType,
    matchedExecutionId,
    message: matchedExecutionId ? "processed" : "ignored",
  };
}

export async function listUnmatchedWebhookEvents(limit = 50): Promise<UnmatchedWebhookReportItem[]> {
  const store = await readStore();
  return store.webhookInbox
    .filter(isUnmatchedWebhookRecord)
    .sort((a, b) => b.receivedAt.localeCompare(a.receivedAt))
    .slice(0, limit)
    .map((item) => ({
      id: item.id,
      eventId: item.eventId,
      eventType: item.eventType,
      status: item.status,
      receivedAt: item.receivedAt,
      processedAt: item.processedAt,
    }));
}
