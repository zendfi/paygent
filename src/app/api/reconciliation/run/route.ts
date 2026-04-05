import { logAudit } from "@/lib/audit/logger";
import { reconcileStaleExecutions } from "@/lib/services/execution";
import { NextResponse } from "next/server";

export async function POST(request: Request) {
  try {
    const body = (await request.json().catch(() => ({}))) as {
      staleAfterMinutes?: number;
      limit?: number;
    };

    const result = await reconcileStaleExecutions({
      staleAfterMinutes: body.staleAfterMinutes,
      limit: body.limit,
    });

    logAudit({
      actor: "system",
      action: "reconciliation_run",
      result: "success",
      metadata: result,
    });

    return NextResponse.json({
      success: true,
      ...result,
    });
  } catch (error) {
    logAudit({
      actor: "system",
      action: "reconciliation_run",
      result: "failure",
      metadata: {
        error: error instanceof Error ? error.message : "unknown_error",
      },
    });

    return NextResponse.json(
      {
        success: false,
        error: "reconciliation_run_failed",
        message: error instanceof Error ? error.message : "unknown_error",
      },
      { status: 400 },
    );
  }
}
