import { errorResponse, unknownErrorToApiPayload } from "@/lib/http/errors";
import { runIncidentSimulation } from "@/lib/services/readiness";
import { NextResponse } from "next/server";

export async function POST(request: Request) {
  try {
    const body = (await request.json().catch(() => ({}))) as {
      scenario?: "webhook_outage" | "provider_partial_failure";
    };

    const simulation = await runIncidentSimulation({
      scenario: body.scenario,
    });

    return NextResponse.json({
      success: true,
      simulation,
    });
  } catch (error) {
    return errorResponse(400, unknownErrorToApiPayload(error, "incident_simulation_failed"));
  }
}
