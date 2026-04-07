import { logAudit } from "@/lib/audit/logger";
import {
  ensureActiveSigningGrantForBusiness,
  getActiveSigningGrantByBusinessId,
} from "@/lib/services/signing-grants";
import { NextResponse } from "next/server";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ businessId: string }> },
) {
  const { businessId } = await params;
  const signingGrant = await getActiveSigningGrantByBusinessId(businessId);
  return NextResponse.json({ signingGrant: signingGrant ?? null });
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ businessId: string }> },
) {
  try {
    const { businessId } = await params;
    const body = (await request.json().catch(() => ({}))) as {
      requestedBy?: string;
      reason?: string;
    };

    const signingGrant = await ensureActiveSigningGrantForBusiness({
      businessId,
      requestedBy: body.requestedBy ?? "owner",
      reason: body.reason ?? "manual_refresh",
    });

    logAudit({
      actor: "owner",
      action: "signing_grant_ensured",
      result: "success",
      businessId,
      metadata: {
        signingGrantId: signingGrant.zendfiSigningGrantId,
        requestedBy: body.requestedBy ?? "owner",
      },
    });

    return NextResponse.json({ success: true, signingGrant });
  } catch (error) {
    const { businessId } = await params;
    logAudit({
      actor: "owner",
      action: "signing_grant_ensured",
      result: "failure",
      businessId,
      metadata: {
        error: error instanceof Error ? error.message : "unknown_error",
      },
    });

    return NextResponse.json(
      {
        error: "signing_grant_ensure_failed",
        message: error instanceof Error ? error.message : "unknown_error",
      },
      { status: 400 },
    );
  }
}
