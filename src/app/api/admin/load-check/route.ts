import { logAudit } from "@/lib/audit/logger";
import { errorResponse, unknownErrorToApiPayload } from "@/lib/http/errors";
import { runLoadCheck } from "@/lib/services/load-check";
import { NextResponse } from "next/server";

export async function POST(request: Request) {
  try {
    const body = (await request.json().catch(() => ({}))) as {
      iterations?: number;
    };

    const result = await runLoadCheck({
      iterations: body.iterations,
    });

    logAudit({
      actor: "system",
      action: "load_check_run",
      result: "success",
      metadata: result,
    });

    return NextResponse.json({
      success: true,
      ...result,
    });
  } catch (error) {
    const payload = unknownErrorToApiPayload(error, "load_check_failed");
    logAudit({
      actor: "system",
      action: "load_check_run",
      result: "failure",
      metadata: payload,
    });
    return errorResponse(400, payload);
  }
}
