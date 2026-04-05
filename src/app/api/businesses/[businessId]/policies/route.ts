import { logAudit } from "@/lib/audit/logger";
import { createPolicyVersion, listPolicies } from "@/lib/services/policies";
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

    logAudit({
      actor: "owner",
      action: "policy_activated",
      result: "success",
      businessId,
      metadata: {
        policyId: policy.id,
      },
    });

    return NextResponse.json({ success: true, policy }, { status: 201 });
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
