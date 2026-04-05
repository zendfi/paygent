import { logAudit } from "@/lib/audit/logger";
import type { PayoutIntentInput } from "@/lib/domain/types";
import { executePayoutIntent } from "@/lib/services/execution";
import { createAndEvaluatePayoutIntent } from "@/lib/services/payout-intents";
import { NextResponse } from "next/server";

function parsePayoutIntent(body: unknown): PayoutIntentInput {
  const data = body as Partial<PayoutIntentInput>;

  if (!data || typeof data !== "object") {
    throw new Error("invalid_request_body");
  }

  if (!data.businessId || !data.supplierId || !data.source || !data.idempotencyKey) {
    throw new Error("missing_required_fields");
  }

  if (typeof data.amountNgn !== "number") {
    throw new Error("invalid_amount");
  }

  return {
    businessId: data.businessId,
    supplierId: data.supplierId,
    amountNgn: data.amountNgn,
    reason: data.reason,
    source: data.source,
    idempotencyKey: data.idempotencyKey,
  };
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const input = parsePayoutIntent(body);
    const evaluated = await createAndEvaluatePayoutIntent(input);
    const { intent } = evaluated;
    const statusCode = intent.status === "rejected" ? 400 : 200;

    let executionSummary: { id: string; status: string } | undefined;
    if (intent.status === "queued") {
      try {
        const execution = await executePayoutIntent(intent.id);
        executionSummary = {
          id: execution.id,
          status: execution.status,
        };
      } catch (executionError) {
        logAudit({
          actor: "system",
          action: "payout_execution_handoff_failed",
          result: "failure",
          businessId: input.businessId,
          metadata: {
            intentId: intent.id,
            error:
              executionError instanceof Error ? executionError.message : "unknown_execution_error",
          },
        });
      }
    }

    logAudit({
      actor: "system",
      action: "payout_intent_evaluated",
      result: intent.decision.allowed ? "success" : "failure",
      businessId: input.businessId,
      reasonCodes: intent.decision.reasonCodes,
      metadata: {
        supplierId: input.supplierId,
        amountNgn: input.amountNgn,
        requiresApproval: intent.decision.requiresApproval,
        status: intent.status,
        spentTodayNgn: evaluated.spentTodayNgn,
        reused: evaluated.reused,
      },
    });

    return NextResponse.json(
      {
        status: intent.status,
        decision: intent.decision,
        intentId: intent.id,
        execution: executionSummary,
        spentTodayNgn: evaluated.spentTodayNgn,
        reused: evaluated.reused,
      },
      { status: statusCode },
    );
  } catch (error) {
    return NextResponse.json(
      {
        error: "payout_intent_validation_failed",
        message: error instanceof Error ? error.message : "unknown_error",
      },
      { status: 400 },
    );
  }
}
