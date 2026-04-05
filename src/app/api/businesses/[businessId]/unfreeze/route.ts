import { logAudit } from "@/lib/audit/logger";
import { getSubaccountByBusinessId, setBusinessStatus } from "@/lib/services/businesses";
import { unfreezeSubaccount } from "@/lib/zendfi/client";
import { NextResponse } from "next/server";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ businessId: string }> },
) {
  try {
    const { businessId } = await params;
    const body = (await request.json()) as { reason?: string };
    const subaccount = await getSubaccountByBusinessId(businessId);

    if (!subaccount) {
      return NextResponse.json(
        {
          error: "subaccount_not_initialized",
          message: "Initialize subaccount before unfreezing the business.",
        },
        { status: 400 },
      );
    }

    await unfreezeSubaccount(subaccount.zendfiSubaccountId, body.reason ?? "manual_override");
    await setBusinessStatus(businessId, "active");

    logAudit({
      actor: "owner",
      action: "business_unfrozen",
      result: "success",
      businessId,
      metadata: {
        subaccountId: subaccount.zendfiSubaccountId,
      },
    });

    return NextResponse.json({
      success: true,
      businessId,
      status: "active",
    });
  } catch (error) {
    logAudit({
      actor: "owner",
      action: "business_unfrozen",
      result: "failure",
      businessId: (await params).businessId,
      metadata: {
        error: error instanceof Error ? error.message : "unknown_error",
      },
    });

    return NextResponse.json(
      {
        error: "unfreeze_failed",
        message: error instanceof Error ? error.message : "unknown_error",
      },
      { status: 400 },
    );
  }
}
