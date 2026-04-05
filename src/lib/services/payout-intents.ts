import type { PolicySnapshot, PayoutIntentInput } from "@/lib/domain/types";
import { evaluatePolicy } from "@/lib/policies/engine";
import { addActivityEvent } from "@/lib/services/activity";
import { getBusinessById } from "@/lib/services/businesses";
import { getOrCreatePilotMode, incrementAutoExecutedCount } from "@/lib/services/pilot";
import { getActivePolicy } from "@/lib/services/policies";
import { getTodaySpentNgn, incrementTodaySpentNgn } from "@/lib/services/spending";
import { getSupplierById } from "@/lib/services/suppliers";
import { readStore, writeStore } from "@/lib/storage/store";
import type { PayoutIntentRecord } from "@/lib/storage/types";

type EvaluatedPayoutIntent = {
  intent: PayoutIntentRecord;
  reused: boolean;
  spentTodayNgn: number;
};

function makeId(prefix: string): string {
  return `${prefix}_${crypto.randomUUID().replaceAll("-", "").slice(0, 16)}`;
}

function nowIso(): string {
  return new Date().toISOString();
}

export async function createAndEvaluatePayoutIntent(
  input: PayoutIntentInput,
): Promise<EvaluatedPayoutIntent> {
  const existingStore = await readStore();
  const existing = existingStore.payoutIntents.find(
    (intent) =>
      intent.businessId === input.businessId && intent.idempotencyKey === input.idempotencyKey,
  );

  if (existing) {
    const spentTodayNgn = await getTodaySpentNgn(input.businessId);
    return { intent: existing, reused: true, spentTodayNgn };
  }

  const [business, supplier, activePolicy, spentTodayNgn, pilotMode] = await Promise.all([
    getBusinessById(input.businessId),
    getSupplierById(input.businessId, input.supplierId),
    getActivePolicy(input.businessId),
    getTodaySpentNgn(input.businessId),
    getOrCreatePilotMode(input.businessId),
  ]);

  if (!business) {
    throw new Error("business_not_found");
  }

  if (!supplier) {
    throw new Error("supplier_not_found");
  }

  if (!activePolicy) {
    throw new Error("active_policy_not_found");
  }

  const policySnapshot: PolicySnapshot = {
    maxPerTxNgn: activePolicy.maxPerTxNgn,
    dailyCapNgn: activePolicy.dailyCapNgn,
    approvalThresholdNgn: activePolicy.approvalThresholdNgn,
    activeDaysUtc: activePolicy.activeDaysUtc,
    activeStartTimeUtc: activePolicy.activeStartTimeUtc,
    activeEndTimeUtc: activePolicy.activeEndTimeUtc,
  };

  const decision = evaluatePolicy({
    amountNgn: input.amountNgn,
    spentTodayNgn,
    nowUtc: new Date(),
    policy: policySnapshot,
    isSupplierWhitelisted: supplier.enabled,
    isBusinessFrozen: business.status === "frozen",
    hasSufficientBalance: true,
  });

  let status: PayoutIntentRecord["status"] = !decision.allowed
    ? "rejected"
    : decision.requiresApproval
      ? "approval_required"
      : "queued";

  const safeLaunchAssisted = business.pilotStage === "safe_launch" && pilotMode.mode === "assisted";
  const safeLaunchAutoLimited =
    business.pilotStage === "safe_launch" &&
    pilotMode.mode === "autonomous" &&
    pilotMode.autoExecutedCount >= pilotMode.maxAutoExecutions;

  if (status === "queued" && (safeLaunchAssisted || safeLaunchAutoLimited)) {
    status = "approval_required";
    if (!decision.reasonCodes.includes("safe_launch_control")) {
      decision.reasonCodes.push("safe_launch_control");
    }
  }

  const timestamp = nowIso();
  const intent: PayoutIntentRecord = {
    id: makeId("pi"),
    businessId: input.businessId,
    supplierId: input.supplierId,
    source: input.source,
    amountNgn: input.amountNgn,
    reason: input.reason,
    idempotencyKey: input.idempotencyKey,
    status,
    decision,
    createdAt: timestamp,
    updatedAt: timestamp,
  };

  const store = await readStore();
  store.payoutIntents.push(intent);
  await writeStore(store);

  await addActivityEvent({
    businessId: input.businessId,
    type: "payout_intent_created",
    message: `Payout intent created for supplier ${input.supplierId}.`,
    metadata: {
      intentId: intent.id,
      amountNgn: input.amountNgn,
      status,
    },
  });

  if (status === "approval_required") {
    await addActivityEvent({
      businessId: input.businessId,
      type: "payout_approval_required",
      message: `Payout intent ${intent.id} requires owner approval.`,
      metadata: {
        intentId: intent.id,
      },
    });
  }

  if (status === "approval_required" && safeLaunchAutoLimited) {
    await addActivityEvent({
      businessId: input.businessId,
      type: "safe_launch_auto_limited",
      message: `Safe-launch auto-execution limit reached for business ${input.businessId}.`,
      metadata: {
        maxAutoExecutions: pilotMode.maxAutoExecutions,
        autoExecutedCount: pilotMode.autoExecutedCount,
      },
    });
  }

  if (status === "queued") {
    await incrementTodaySpentNgn(input.businessId, input.amountNgn);
    if (business.pilotStage === "safe_launch" && pilotMode.mode === "autonomous") {
      await incrementAutoExecutedCount(input.businessId);
    }
  }

  const updatedSpentToday = await getTodaySpentNgn(input.businessId);
  return {
    intent,
    reused: false,
    spentTodayNgn: updatedSpentToday,
  };
}

export async function getPayoutIntentById(
  intentId: string,
): Promise<PayoutIntentRecord | undefined> {
  const store = await readStore();
  return store.payoutIntents.find((intent) => intent.id === intentId);
}

export async function listPayoutIntentsByBusiness(
  businessId: string,
): Promise<PayoutIntentRecord[]> {
  const store = await readStore();
  return store.payoutIntents
    .filter((intent) => intent.businessId === businessId)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export async function setPayoutIntentStatus(
  intentId: string,
  status: PayoutIntentRecord["status"],
): Promise<PayoutIntentRecord> {
  const store = await readStore();
  const intent = store.payoutIntents.find((entry) => entry.id === intentId);
  if (!intent) {
    throw new Error("intent_not_found");
  }

  intent.status = status;
  intent.updatedAt = nowIso();
  await writeStore(store);
  return intent;
}

export async function approvePayoutIntent(intentId: string): Promise<PayoutIntentRecord> {
  const intent = await getPayoutIntentById(intentId);
  if (!intent) {
    throw new Error("intent_not_found");
  }

  if (intent.status !== "approval_required") {
    throw new Error("intent_not_pending_approval");
  }

  const [business, supplier, activePolicy, spentTodayNgn] = await Promise.all([
    getBusinessById(intent.businessId),
    getSupplierById(intent.businessId, intent.supplierId),
    getActivePolicy(intent.businessId),
    getTodaySpentNgn(intent.businessId),
  ]);

  if (!business) {
    throw new Error("business_not_found");
  }
  if (!supplier) {
    throw new Error("supplier_not_found");
  }
  if (!activePolicy) {
    throw new Error("active_policy_not_found");
  }

  const decision = evaluatePolicy({
    amountNgn: intent.amountNgn,
    spentTodayNgn,
    nowUtc: new Date(),
    policy: {
      maxPerTxNgn: activePolicy.maxPerTxNgn,
      dailyCapNgn: activePolicy.dailyCapNgn,
      approvalThresholdNgn: activePolicy.approvalThresholdNgn,
      activeDaysUtc: activePolicy.activeDaysUtc,
      activeStartTimeUtc: activePolicy.activeStartTimeUtc,
      activeEndTimeUtc: activePolicy.activeEndTimeUtc,
    },
    isSupplierWhitelisted: supplier.enabled,
    isBusinessFrozen: business.status === "frozen",
    hasSufficientBalance: true,
  });

  if (!decision.allowed) {
    throw new Error(`approval_guardrail_failed:${decision.reasonCodes.join(",")}`);
  }

  await incrementTodaySpentNgn(intent.businessId, intent.amountNgn);
  const updated = await setPayoutIntentStatus(intent.id, "approved");

  await addActivityEvent({
    businessId: updated.businessId,
    type: "payout_approved",
    message: `Payout intent ${updated.id} approved by owner.`,
    metadata: {
      intentId: updated.id,
      amountNgn: updated.amountNgn,
    },
  });

  return updated;
}

export async function rejectPayoutIntent(intentId: string): Promise<PayoutIntentRecord> {
  const intent = await getPayoutIntentById(intentId);
  if (!intent) {
    throw new Error("intent_not_found");
  }

  if (intent.status !== "approval_required") {
    throw new Error("intent_not_pending_approval");
  }

  const updated = await setPayoutIntentStatus(intent.id, "rejected");

  await addActivityEvent({
    businessId: updated.businessId,
    type: "payout_rejected",
    message: `Payout intent ${updated.id} rejected by owner.`,
    metadata: {
      intentId: updated.id,
    },
  });

  return updated;
}
