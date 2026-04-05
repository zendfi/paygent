import { logAudit } from "@/lib/audit/logger";
import { getSubaccountByBusinessId, setBusinessStatus } from "@/lib/services/businesses";
import { freezeSubaccount } from "@/lib/zendfi/client";
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
          message: "Initialize subaccount before freezing the business.",
        },
        { status: 400 },
      );
    }

    await freezeSubaccount(
      subaccount.zendfiSubaccountId,
      body.reason ?? "manual_override",
    );
    await setBusinessStatus(businessId, "frozen");

    logAudit({
      actor: "owner",
      action: "business_frozen",
      result: "success",
      businessId,
      metadata: { subaccountId: subaccount.zendfiSubaccountId },
    });

    return NextResponse.json({
      success: true,
      businessId,
      status: "frozen",
    });
  } catch (error) {
    const { businessId } = await params;
    logAudit({
      actor: "owner",
      action: "business_frozen",
      result: "failure",
      businessId,
      metadata: {
        error: error instanceof Error ? error.message : "unknown_error",
      },
    });

    return NextResponse.json(
      {
        error: "freeze_failed",
        message: error instanceof Error ? error.message : "unknown_error",
      },
      { status: 400 },
    );
  }
}
