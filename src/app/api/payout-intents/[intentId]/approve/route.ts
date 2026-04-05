import { logAudit } from "@/lib/audit/logger";
import { executePayoutIntent } from "@/lib/services/execution";
import { approvePayoutIntent } from "@/lib/services/payout-intents";
import { NextResponse } from "next/server";

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ intentId: string }> },
) {
  try {
    const { intentId } = await params;
    const approvedIntent = await approvePayoutIntent(intentId);
    const execution = await executePayoutIntent(approvedIntent.id);

    logAudit({
      actor: "owner",
      action: "payout_intent_approved",
      result: "success",
      businessId: approvedIntent.businessId,
      metadata: {
        intentId: approvedIntent.id,
        executionId: execution.id,
      },
    });

    return NextResponse.json({
      success: true,
      intent: approvedIntent,
      execution,
    });
  } catch (error) {
    const { intentId } = await params;
    logAudit({
      actor: "owner",
      action: "payout_intent_approved",
      result: "failure",
      metadata: {
        intentId,
        error: error instanceof Error ? error.message : "unknown_error",
      },
    });

    return NextResponse.json(
      {
        error: "payout_intent_approve_failed",
        message: error instanceof Error ? error.message : "unknown_error",
      },
      { status: 400 },
    );
  }
}
