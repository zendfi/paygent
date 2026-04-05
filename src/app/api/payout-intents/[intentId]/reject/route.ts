import { logAudit } from "@/lib/audit/logger";
import { rejectPayoutIntent } from "@/lib/services/payout-intents";
import { NextResponse } from "next/server";

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ intentId: string }> },
) {
  try {
    const { intentId } = await params;
    const rejectedIntent = await rejectPayoutIntent(intentId);

    logAudit({
      actor: "owner",
      action: "payout_intent_rejected",
      result: "success",
      businessId: rejectedIntent.businessId,
      metadata: {
        intentId: rejectedIntent.id,
      },
    });

    return NextResponse.json({
      success: true,
      intent: rejectedIntent,
    });
  } catch (error) {
    const { intentId } = await params;
    logAudit({
      actor: "owner",
      action: "payout_intent_rejected",
      result: "failure",
      metadata: {
        intentId,
        error: error instanceof Error ? error.message : "unknown_error",
      },
    });

    return NextResponse.json(
      {
        error: "payout_intent_reject_failed",
        message: error instanceof Error ? error.message : "unknown_error",
      },
      { status: 400 },
    );
  }
}
