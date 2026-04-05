import { logAudit } from "@/lib/audit/logger";
import { getSubaccountByBusinessId } from "@/lib/services/businesses";
import { createTopupPaymentLink } from "@/lib/zendfi/client";
import { NextResponse } from "next/server";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ businessId: string }> },
) {
  try {
    const { businessId } = await params;
    const body = (await request.json()) as {
      amount?: number;
      description?: string;
    };

    if (!body.amount || body.amount <= 0) {
      return NextResponse.json(
        {
          error: "invalid_amount",
          message: "amount must be a positive number",
        },
        { status: 400 },
      );
    }

    const subaccount = await getSubaccountByBusinessId(businessId);
    if (!subaccount) {
      return NextResponse.json(
        {
          error: "subaccount_not_initialized",
          message: "Initialize subaccount before creating top-up links.",
        },
        { status: 400 },
      );
    }

    const link = await createTopupPaymentLink({
      amount: body.amount,
      businessId,
      subAccountId: subaccount.zendfiSubaccountId,
    });

    logAudit({
      actor: "owner",
      action: "topup_link_created",
      result: "success",
      businessId,
      metadata: {
        amount: body.amount,
        linkId: link.id,
      },
    });

    return NextResponse.json({
      success: true,
      paymentLinkId: link.id,
      url: link.url,
    });
  } catch (error) {
    return NextResponse.json(
      {
        error: "topup_link_creation_failed",
        message: error instanceof Error ? error.message : "unknown_error",
      },
      { status: 400 },
    );
  }
}
