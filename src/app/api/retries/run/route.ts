import { logAudit } from "@/lib/audit/logger";
import { runDueRetryJobs } from "@/lib/services/execution";
import { NextResponse } from "next/server";

export async function POST(request: Request) {
  try {
    const body = (await request.json().catch(() => ({}))) as {
      limit?: number;
    };

    const result = await runDueRetryJobs(body.limit ?? 20);

    logAudit({
      actor: "system",
      action: "retry_run",
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
      action: "retry_run",
      result: "failure",
      metadata: {
        error: error instanceof Error ? error.message : "unknown_error",
      },
    });

    return NextResponse.json(
      {
        success: false,
        error: "retry_run_failed",
        message: error instanceof Error ? error.message : "unknown_error",
      },
      { status: 400 },
    );
  }
}
