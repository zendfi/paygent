import { logAudit } from "@/lib/audit/logger";
import { errorResponse, unknownErrorToApiPayload } from "@/lib/http/errors";
import { expandPilotBusinesses } from "@/lib/services/pilot-expansion";
import { NextResponse } from "next/server";

export async function POST(request: Request) {
  try {
    const body = (await request.json().catch(() => ({}))) as {
      targetCount?: number;
      dryRun?: boolean;
    };

    const result = await expandPilotBusinesses({
      targetCount: body.targetCount,
      dryRun: body.dryRun,
    });

    logAudit({
      actor: "owner",
      action: "pilot_expansion_run",
      result: "success",
      metadata: result,
    });

    return NextResponse.json({
      success: true,
      ...result,
    });
  } catch (error) {
    const payload = unknownErrorToApiPayload(error, "pilot_expansion_failed");
    logAudit({
      actor: "owner",
      action: "pilot_expansion_run",
      result: "failure",
      metadata: payload,
    });
    return errorResponse(400, payload);
  }
}
