import { logAudit } from "@/lib/audit/logger";
import { createPolicyVersion, listPolicies } from "@/lib/services/policies";
import { ensureActiveSigningGrantForBusiness, revokeSigningGrantsForBusiness } from "@/lib/services/signing-grants";
import { NextResponse } from "next/server";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ businessId: string }> },
) {
  const { businessId } = await params;
  const policies = await listPolicies(businessId);
  return NextResponse.json({ policies });
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ businessId: string }> },
) {
  try {
    const { businessId } = await params;
    const body = (await request.json()) as {
      maxPerTxNgn?: number;
      dailyCapNgn?: number;
      approvalThresholdNgn?: number;
      activeDaysUtc?: number[];
      activeStartTimeUtc?: string;
      activeEndTimeUtc?: string;
    };

    const policy = await createPolicyVersion({
      businessId,
      maxPerTxNgn: Number(body.maxPerTxNgn),
      dailyCapNgn: Number(body.dailyCapNgn),
      approvalThresholdNgn: Number(body.approvalThresholdNgn),
      activeDaysUtc: body.activeDaysUtc ?? [],
      activeStartTimeUtc: body.activeStartTimeUtc ?? "",
      activeEndTimeUtc: body.activeEndTimeUtc ?? "",
    });

    await revokeSigningGrantsForBusiness(businessId, "policy_rotated");
    let signingGrant:
      | {
          id: string;
          zendfiSigningGrantId: string;
        }
      | undefined;
    let signingGrantWarning: string | undefined;

    try {
      signingGrant = await ensureActiveSigningGrantForBusiness({
        businessId,
        requestedBy: "owner",
        reason: "policy_activated",
      });
    } catch (error) {
      signingGrantWarning =
        error instanceof Error ? error.message : "signing_grant_provision_failed";
    }

    logAudit({
      actor: "owner",
      action: "policy_activated",
      result: "success",
      businessId,
      metadata: {
        policyId: policy.id,
        signingGrantId: signingGrant?.zendfiSigningGrantId,
        signingGrantWarning,
      },
    });

    return NextResponse.json({ success: true, policy, signingGrant, signingGrantWarning }, { status: 201 });
  } catch (error) {
    return NextResponse.json(
      {
        error: "policy_create_failed",
        message: error instanceof Error ? error.message : "unknown_error",
      },
      { status: 400 },
    );
  }
}
