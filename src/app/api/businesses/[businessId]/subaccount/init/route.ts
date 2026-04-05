import { logAudit } from "@/lib/audit/logger";
import { initSubaccountForBusiness } from "@/lib/services/businesses";
import { NextResponse } from "next/server";

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ businessId: string }> },
) {
  try {
    const { businessId } = await params;
    const result = await initSubaccountForBusiness(businessId);

    logAudit({
      actor: "system",
      action: "subaccount_initialized",
      result: "success",
      businessId,
      metadata: {
        zendfiSubaccountId: result.subaccount.zendfiSubaccountId,
        created: result.created,
      },
    });

    return NextResponse.json({
      success: true,
      business: result.business,
      subaccount: result.subaccount,
      created: result.created,
    });
  } catch (error) {
    return NextResponse.json(
      {
        error: "subaccount_init_failed",
        message: error instanceof Error ? error.message : "unknown_error",
      },
      { status: 400 },
    );
  }
}
