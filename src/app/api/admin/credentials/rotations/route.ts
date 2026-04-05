import {
  listCredentialRotations,
  requestCredentialRotation,
} from "@/lib/services/credentials";
import { errorResponse, unknownErrorToApiPayload } from "@/lib/http/errors";
import { NextResponse } from "next/server";

export async function GET(request: Request) {
  const limitRaw = Number(new URL(request.url).searchParams.get("limit") ?? 100);
  const limit = Number.isFinite(limitRaw) && limitRaw > 0 ? limitRaw : 100;
  const rotations = await listCredentialRotations(limit);
  return NextResponse.json({
    count: rotations.length,
    rotations,
  });
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as {
      credentialType?: "owner_api_token" | "zendfi_api_key" | "zendfi_webhook_secret";
      requestedBy?: string;
      reason?: string;
    };

    if (!body.credentialType || !body.requestedBy || !body.reason) {
      return errorResponse(400, {
        error: "invalid_request",
        message: "credentialType, requestedBy and reason are required",
      });
    }

    const rotation = await requestCredentialRotation({
      credentialType: body.credentialType,
      requestedBy: body.requestedBy,
      reason: body.reason,
    });

    return NextResponse.json({
      success: true,
      rotation,
    });
  } catch (error) {
    return errorResponse(400, unknownErrorToApiPayload(error, "rotation_request_failed"));
  }
}
