import { addActivityEvent } from "@/lib/services/activity";
import { getSubaccountByBusinessId } from "@/lib/services/businesses";
import { sendOwnerNotification } from "@/lib/services/notifications";
import { getPayoutIntentById, setPayoutIntentStatus } from "@/lib/services/payout-intents";
import { getSupplierById } from "@/lib/services/suppliers";
import { readStore, writeStore } from "@/lib/storage/store";
import type { PayoutExecutionRecord, RetryJobRecord } from "@/lib/storage/types";
import { getWithdrawalStatus, withdrawSubaccountToBank } from "@/lib/zendfi/client";

const RETRY_DELAYS_SECONDS = [30, 120, 300] as const;
const MAX_RETRY_ATTEMPTS = RETRY_DELAYS_SECONDS.length;

type FinalExecutionStatus = "completed" | "failed";

function makeId(prefix: string): string {
  return `${prefix}_${crypto.randomUUID().replaceAll("-", "").slice(0, 16)}`;
}

function nowIso(): string {
  return new Date().toISOString();
}

function plusSeconds(baseIso: string, seconds: number): string {
  const base = new Date(baseIso).getTime();
  return new Date(base + seconds * 1000).toISOString();
}

function isTransientProviderError(error: unknown): boolean {
  const message = error instanceof Error ? error.message.toLowerCase() : "";
  return (
    message.includes("timeout") ||
    message.includes("network") ||
    message.includes("429") ||
    message.includes("502") ||
    message.includes("503") ||
    message.includes("504") ||
    message.includes("fetch failed")
  );
}

export async function listExecutionsByBusiness(
  businessId: string,
): Promise<PayoutExecutionRecord[]> {
  const store = await readStore();
  return store.payoutExecutions
    .filter((execution) => execution.businessId === businessId)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export async function listRetryJobsByBusiness(
  businessId: string,
  limit = 30,
): Promise<RetryJobRecord[]> {
  const store = await readStore();
  return store.retryJobs
    .filter((job) => job.businessId === businessId)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    .slice(0, limit);
}

export async function executePayoutIntent(intentId: string): Promise<PayoutExecutionRecord> {
  const intent = await getPayoutIntentById(intentId);
  if (!intent) {
    throw new Error("intent_not_found");
  }

  if (intent.status !== "queued" && intent.status !== "approved") {
    throw new Error("intent_not_executable");
  }

  const [supplier, subaccount] = await Promise.all([
    getSupplierById(intent.businessId, intent.supplierId),
    getSubaccountByBusinessId(intent.businessId),
  ]);

  if (!supplier) {
    throw new Error("supplier_not_found");
  }

  if (!subaccount) {
    throw new Error("subaccount_not_initialized");
  }

  await setPayoutIntentStatus(intent.id, "executing");

  const timestamp = nowIso();
  const execution: PayoutExecutionRecord = {
    id: makeId("exec"),
    intentId: intent.id,
    businessId: intent.businessId,
    supplierId: intent.supplierId,
    status: "initiated",
    createdAt: timestamp,
    updatedAt: timestamp,
  };

  const store = await readStore();
  store.payoutExecutions.push(execution);
  await writeStore(store);

  await addActivityEvent({
    businessId: intent.businessId,
    type: "payout_execution_started",
    message: `Execution started for intent ${intent.id}.`,
    metadata: {
      executionId: execution.id,
      intentId: intent.id,
    },
  });

  try {
    const response = await withdrawSubaccountToBank({
      subaccountId: subaccount.zendfiSubaccountId,
      amountUsdc: intent.amountNgn,
      bankId: supplier.bankId,
      accountNumber: supplier.accountNumber,
    });

    const nextStore = await readStore();
    const nextExecution = nextStore.payoutExecutions.find((entry) => entry.id === execution.id);
    if (!nextExecution) {
      throw new Error("execution_not_found_after_start");
    }

    nextExecution.status = response.success ? "pending_webhook" : "failed";
    nextExecution.providerOrderId = response.orderId;
    nextExecution.transactionSignature = response.transactionSignature;
    nextExecution.failureCode = response.success ? undefined : "provider_rejected";
    nextExecution.failureReason = response.success ? undefined : response.status;
    nextExecution.updatedAt = nowIso();
    await writeStore(nextStore);

    if (response.success) {
      await addActivityEvent({
        businessId: intent.businessId,
        type: "webhook_received",
        message: `Execution ${nextExecution.id} accepted by provider; awaiting webhook confirmation.`,
        metadata: {
          executionId: nextExecution.id,
          intentId: intent.id,
          providerOrderId: response.orderId,
        },
      });
      return nextExecution;
    }

    await setPayoutIntentStatus(intent.id, "failed");
    await addActivityEvent({
      businessId: intent.businessId,
      type: "payout_failed",
      message: `Payout failed for intent ${intent.id}.`,
      metadata: {
        executionId: nextExecution.id,
        intentId: intent.id,
        providerOrderId: response.orderId,
        failureReason: response.status,
      },
    });

    await sendOwnerNotification({
      businessId: intent.businessId,
      intentId: intent.id,
      eventType: "payout_failed",
      message: `Payout for intent ${intent.id} failed at provider acceptance (${response.status}).`,
    });

    return nextExecution;
  } catch (error) {
    const nextStore = await readStore();
    const nextExecution = nextStore.payoutExecutions.find((entry) => entry.id === execution.id);
    if (!nextExecution) {
      throw error;
    }

    nextExecution.status = "failed";
    nextExecution.failureCode = "execution_error";
    nextExecution.failureReason = error instanceof Error ? error.message : "unknown_error";
    nextExecution.updatedAt = nowIso();
    await writeStore(nextStore);

    const scheduled = await scheduleRetryForTransientFailure(
      intent.id,
      intent.businessId,
      error,
      nextExecution.id,
    );

    if (!scheduled) {
      await setPayoutIntentStatus(intent.id, "failed");
      await addActivityEvent({
        businessId: intent.businessId,
        type: "payout_failed",
        message: `Payout failed for intent ${intent.id}.`,
        metadata: {
          intentId: intent.id,
          executionId: nextExecution.id,
          error: error instanceof Error ? error.message : "unknown_error",
        },
      });

      await sendOwnerNotification({
        businessId: intent.businessId,
        intentId: intent.id,
        eventType: "payout_failed",
        message: `Payout for intent ${intent.id} failed and will not be retried.`,
      });
    }

    throw error;
  }
}

async function scheduleRetryForTransientFailure(
  intentId: string,
  businessId: string,
  error: unknown,
  executionId: string,
): Promise<boolean> {
  if (!isTransientProviderError(error)) {
    return false;
  }

  const store = await readStore();
  const attempts = store.retryJobs.filter((job) => job.intentId === intentId).length;
  const nextAttempt = attempts + 1;

  if (nextAttempt > MAX_RETRY_ATTEMPTS) {
    store.retryJobs.push({
      id: makeId("retry"),
      intentId,
      businessId,
      attempt: nextAttempt,
      maxAttempts: MAX_RETRY_ATTEMPTS,
      status: "exhausted",
      lastError: error instanceof Error ? error.message : "unknown_error",
      nextRunAt: nowIso(),
      createdAt: nowIso(),
      updatedAt: nowIso(),
    });
    await writeStore(store);

    await addActivityEvent({
      businessId,
      type: "retry_exhausted",
      message: `Retry budget exhausted for intent ${intentId}.`,
      metadata: {
        intentId,
        executionId,
      },
    });

    await sendOwnerNotification({
      businessId,
      intentId,
      eventType: "retry_exhausted",
      message: `Payout for intent ${intentId} exhausted all retries and needs manual review.`,
    });

    return false;
  }

  const timestamp = nowIso();
  const nextRunAt = plusSeconds(timestamp, RETRY_DELAYS_SECONDS[nextAttempt - 1]);
  const job: RetryJobRecord = {
    id: makeId("retry"),
    intentId,
    businessId,
    attempt: nextAttempt,
    maxAttempts: MAX_RETRY_ATTEMPTS,
    status: "scheduled",
    lastError: error instanceof Error ? error.message : "unknown_error",
    nextRunAt,
    createdAt: timestamp,
    updatedAt: timestamp,
  };

  store.retryJobs.push(job);
  await writeStore(store);
  await setPayoutIntentStatus(intentId, "approved");

  await addActivityEvent({
    businessId,
    type: "retry_scheduled",
    message: `Retry ${nextAttempt}/${MAX_RETRY_ATTEMPTS} scheduled for intent ${intentId}.`,
    metadata: {
      intentId,
      executionId,
      nextRunAt,
    },
  });

  return true;
}

export async function runDueRetryJobs(limit = 20): Promise<{
  due: number;
  attempted: number;
  succeeded: number;
  failed: number;
}> {
  const now = nowIso();
  const store = await readStore();
  const dueJobs = store.retryJobs
    .filter((job) => job.status === "scheduled" && job.nextRunAt <= now)
    .sort((a, b) => a.nextRunAt.localeCompare(b.nextRunAt))
    .slice(0, limit);

  let attempted = 0;
  let succeeded = 0;
  let failed = 0;

  for (const job of dueJobs) {
    attempted += 1;
    try {
      await executePayoutIntent(job.intentId);
      const nextStore = await readStore();
      const storedJob = nextStore.retryJobs.find((entry) => entry.id === job.id);
      if (storedJob) {
        storedJob.status = "succeeded";
        storedJob.updatedAt = nowIso();
        await writeStore(nextStore);
      }
      succeeded += 1;
    } catch {
      failed += 1;
    }
  }

  return {
    due: dueJobs.length,
    attempted,
    succeeded,
    failed,
  };
}

export async function applyExecutionOutcomeByProviderOrder(input: {
  providerOrderId: string;
  status: FinalExecutionStatus;
  transactionSignature?: string;
  failureCode?: string;
  failureReason?: string;
  source: "webhook" | "reconciliation";
  rawEventType?: string;
}): Promise<PayoutExecutionRecord | undefined> {
  const store = await readStore();
  const execution = store.payoutExecutions.find(
    (entry) => entry.providerOrderId === input.providerOrderId,
  );

  if (!execution) {
    return undefined;
  }

  if (execution.status === "completed" || execution.status === "failed") {
    return execution;
  }

  execution.status = input.status;
  execution.transactionSignature = input.transactionSignature ?? execution.transactionSignature;
  execution.failureCode = input.failureCode;
  execution.failureReason = input.failureReason;
  execution.updatedAt = nowIso();
  await writeStore(store);

  await setPayoutIntentStatus(execution.intentId, input.status);

  await addActivityEvent({
    businessId: execution.businessId,
    type: input.status === "completed" ? "payout_completed" : "payout_failed",
    message:
      input.status === "completed"
        ? `Payout completed for intent ${execution.intentId}.`
        : `Payout failed for intent ${execution.intentId}.`,
    metadata: {
      executionId: execution.id,
      intentId: execution.intentId,
      providerOrderId: input.providerOrderId,
      source: input.source,
      rawEventType: input.rawEventType,
    },
  });

  await addActivityEvent({
    businessId: execution.businessId,
    type: "payout_reconciled",
    message: `Execution ${execution.id} reconciled via ${input.source}.`,
    metadata: {
      executionId: execution.id,
      intentId: execution.intentId,
      status: input.status,
      providerOrderId: input.providerOrderId,
    },
  });

  await sendOwnerNotification({
    businessId: execution.businessId,
    intentId: execution.intentId,
    eventType: input.status === "completed" ? "payout_completed" : "payout_failed",
    message:
      input.status === "completed"
        ? `Payout for intent ${execution.intentId} completed successfully.`
        : `Payout for intent ${execution.intentId} failed: ${input.failureReason ?? "unknown"}.`,
  });

  return execution;
}

export async function reconcileStaleExecutions(input?: {
  staleAfterMinutes?: number;
  limit?: number;
}): Promise<{
  scanned: number;
  resolved: number;
  unresolved: number;
}> {
  const staleAfterMinutes = input?.staleAfterMinutes ?? 3;
  const limit = input?.limit ?? 30;

  const threshold = Date.now() - staleAfterMinutes * 60 * 1000;
  const store = await readStore();
  const staleExecutions = store.payoutExecutions
    .filter((execution) => {
      if (!execution.providerOrderId) {
        return false;
      }
      if (execution.status !== "initiated" && execution.status !== "pending_webhook") {
        return false;
      }
      return new Date(execution.updatedAt).getTime() <= threshold;
    })
    .slice(0, limit);

  let resolved = 0;

  for (const execution of staleExecutions) {
    try {
      const providerState = await getWithdrawalStatus(execution.providerOrderId as string);
      if (providerState.status === "completed") {
        await applyExecutionOutcomeByProviderOrder({
          providerOrderId: execution.providerOrderId as string,
          status: "completed",
          transactionSignature: providerState.transactionSignature,
          source: "reconciliation",
          rawEventType: "reconciliation.completed",
        });
        resolved += 1;
      } else if (providerState.status === "failed") {
        await applyExecutionOutcomeByProviderOrder({
          providerOrderId: execution.providerOrderId as string,
          status: "failed",
          failureCode: "provider_failed",
          failureReason: providerState.failureReason,
          source: "reconciliation",
          rawEventType: "reconciliation.failed",
        });
        resolved += 1;
      }
    } catch {
      // Reconciliation must be best-effort and non-blocking.
    }
  }

  return {
    scanned: staleExecutions.length,
    resolved,
    unresolved: staleExecutions.length - resolved,
  };
}
