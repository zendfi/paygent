import { completeCredentialRotation } from "@/lib/services/credentials";
import { errorResponse, unknownErrorToApiPayload } from "@/lib/http/errors";
import { NextResponse } from "next/server";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ rotationId: string }> },
) {
  try {
    const { rotationId } = await params;
    const body = (await request.json().catch(() => ({}))) as { notes?: string };

    const rotation = await completeCredentialRotation({
      rotationId,
      notes: body.notes,
    });

    return NextResponse.json({
      success: true,
      rotation,
    });
  } catch (error) {
    return errorResponse(400, unknownErrorToApiPayload(error, "rotation_complete_failed"));
  }
}
