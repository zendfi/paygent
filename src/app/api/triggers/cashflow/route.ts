import { logAudit } from "@/lib/audit/logger";
import { errorResponse, unknownErrorToApiPayload } from "@/lib/http/errors";
import { executePayoutIntent } from "@/lib/services/execution";
import { createAndEvaluatePayoutIntent } from "@/lib/services/payout-intents";
import { NextResponse } from "next/server";

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as {
      businessId?: string;
      supplierId?: string;
      amountNgn?: number;
      reason?: string;
      trigger?: string;
      submit?: boolean;
    };

    if (!body.businessId || !body.supplierId || !body.amountNgn) {
      return errorResponse(400, {
        error: "invalid_request",
        message: "businessId, supplierId and amountNgn are required",
      });
    }

    const evaluated = await createAndEvaluatePayoutIntent({
      businessId: body.businessId,
      supplierId: body.supplierId,
      amountNgn: Number(body.amountNgn),
      reason: body.reason ?? "cashflow_threshold_supplier_settlement",
      source: "cashflow_trigger",
      idempotencyKey: `cash_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    });

    let execution:
      | {
          id: string;
          status: string;
        }
      | undefined;
    let executionError: string | undefined;

    if ((body.submit ?? true) && evaluated.intent.status === "queued") {
      try {
        const started = await executePayoutIntent(evaluated.intent.id);
        execution = {
          id: started.id,
          status: started.status,
        };
      } catch (error) {
        executionError = error instanceof Error ? error.message : "execution_failed";
      }
    }

    logAudit({
      actor: "system",
      action: "cashflow_trigger_evaluated",
      result: executionError ? "failure" : "success",
      businessId: body.businessId,
      metadata: {
        trigger: body.trigger ?? "cashflow_threshold",
        intentId: evaluated.intent.id,
        intentStatus: evaluated.intent.status,
        executionError,
      },
    });

    return NextResponse.json({
      success: true,
      intent: evaluated.intent,
      spentTodayNgn: evaluated.spentTodayNgn,
      execution,
      executionError,
    });
  } catch (error) {
    return errorResponse(400, unknownErrorToApiPayload(error, "cashflow_trigger_failed"));
  }
}
