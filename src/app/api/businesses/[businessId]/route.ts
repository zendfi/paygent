import {
  getBusinessById,
  getSubaccountByBusinessId,
} from "@/lib/services/businesses";
import { getActivePolicy } from "@/lib/services/policies";
import { getOrCreatePilotMode } from "@/lib/services/pilot";
import { getTodaySpentNgn } from "@/lib/services/spending";
import { listSuppliers } from "@/lib/services/suppliers";
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

  const [subaccount, suppliers, activePolicy, spentTodayNgn, pilotMode] = await Promise.all([
    getSubaccountByBusinessId(businessId),
    listSuppliers(businessId),
    getActivePolicy(businessId),
    getTodaySpentNgn(businessId),
    getOrCreatePilotMode(businessId),
  ]);

  const subaccountBalance = subaccount
    ? await getSubaccountBalance(subaccount.zendfiSubaccountId)
    : undefined;

  return NextResponse.json({
    business,
    subaccount,
    suppliers,
    activePolicy,
    spentTodayNgn,
    pilotMode,
    subaccountBalance,
  });
}
