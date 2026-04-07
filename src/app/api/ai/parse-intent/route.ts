import { logAudit } from "@/lib/audit/logger";
import { errorResponse, unknownErrorToApiPayload } from "@/lib/http/errors";
import { parseOwnerCommandToIntent } from "@/lib/services/ai-intents";
import { executePayoutIntent } from "@/lib/services/execution";
import { createAndEvaluatePayoutIntent } from "@/lib/services/payout-intents";
import { NextResponse } from "next/server";

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as {
      businessId?: string;
      command?: string;
      submit?: boolean;
    };

    if (!body.businessId || !body.command) {
      return errorResponse(
        400,
        {
          error: "invalid_request",
          message: "businessId and command are required",
        },
      );
    }

    const parsed = await parseOwnerCommandToIntent({
      businessId: body.businessId,
      command: body.command,
    });

    let submission:
      | {
          intentId: string;
          status: string;
          execution?: { id: string; status: string };
          executionError?: string;
        }
      | undefined;

    if (body.submit && parsed.parsed.supplierId && parsed.parsed.amountNgn) {
      const evaluated = await createAndEvaluatePayoutIntent({
        businessId: body.businessId,
        supplierId: parsed.parsed.supplierId,
        amountNgn: parsed.parsed.amountNgn,
        reason: parsed.parsed.reason,
        source: "owner_command",
        idempotencyKey: `ai_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      });

      submission = {
        intentId: evaluated.intent.id,
        status: evaluated.intent.status,
      };

      if (evaluated.intent.status === "queued") {
        try {
          const execution = await executePayoutIntent(evaluated.intent.id);
          submission.execution = {
            id: execution.id,
            status: execution.status,
          };
        } catch (error) {
          // Keep parse endpoint non-blocking but return the execution failure to the client.
          submission.executionError =
            error instanceof Error ? error.message : "execution_handoff_failed";
        }
      }
    }

    logAudit({
      actor: "owner",
      action: "ai_intent_parsed",
      result: "success",
      businessId: body.businessId,
      metadata: {
        action: parsed.decision.action,
        confidence: parsed.decision.confidence,
        submit: Boolean(body.submit),
        submittedIntentId: submission?.intentId,
        executionError: submission?.executionError,
      },
    });

    return NextResponse.json({
      success: true,
      parsed,
      submission,
    });
  } catch (error) {
    return errorResponse(400, unknownErrorToApiPayload(error, "ai_parse_failed"));
  }
}
