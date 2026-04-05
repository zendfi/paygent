import { getBusinessById, getSubaccountByBusinessId } from "@/lib/services/businesses";
import { getSubaccountBalance } from "@/lib/zendfi/client";
import { NextResponse } from "next/server";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ businessId: string }> },
) {
  const { businessId } = await params;
  const business = await getBusinessById(businessId);

  if (!business) {
    return NextResponse.json(
      {
        error: "business_not_found",
      },
      { status: 404 },
    );
  }

  const subaccount = await getSubaccountByBusinessId(businessId);
  if (!subaccount) {
    return NextResponse.json(
      {
        error: "subaccount_not_initialized",
        message: "Initialize subaccount before fetching balance.",
      },
      { status: 400 },
    );
  }

  const balance = await getSubaccountBalance(subaccount.zendfiSubaccountId);

  return NextResponse.json({
    businessId,
    subaccountId: subaccount.zendfiSubaccountId,
    balance,
  });
}
