import { getOrCreatePilotMode, updatePilotMode } from "@/lib/services/pilot";
import { NextResponse } from "next/server";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ businessId: string }> },
) {
  const { businessId } = await params;
  const pilotMode = await getOrCreatePilotMode(businessId);
  return NextResponse.json({ pilotMode });
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ businessId: string }> },
) {
  try {
    const { businessId } = await params;
    const body = (await request.json()) as {
      mode?: "assisted" | "autonomous";
      maxAutoExecutions?: number;
    };

    if (body.mode !== "assisted" && body.mode !== "autonomous") {
      return NextResponse.json(
        {
          error: "invalid_mode",
          message: "mode must be either assisted or autonomous",
        },
        { status: 400 },
      );
    }

    const pilotMode = await updatePilotMode({
      businessId,
      mode: body.mode,
      maxAutoExecutions: body.maxAutoExecutions,
    });

    return NextResponse.json({
      success: true,
      pilotMode,
    });
  } catch (error) {
    return NextResponse.json(
      {
        error: "pilot_mode_update_failed",
        message: error instanceof Error ? error.message : "unknown_error",
      },
      { status: 400 },
    );
  }
}
