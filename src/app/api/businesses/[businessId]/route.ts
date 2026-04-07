import {
  getBusinessById,
  getSubaccountByBusinessId,
} from "@/lib/services/businesses";
import { getActivePolicy } from "@/lib/services/policies";
import { getOrCreatePilotMode } from "@/lib/services/pilot";
import { getActiveSigningGrantByBusinessId } from "@/lib/services/signing-grants";
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

  const [subaccount, suppliers, activePolicy, spentTodayNgn, pilotMode, activeSigningGrant] = await Promise.all([
    getSubaccountByBusinessId(businessId),
    listSuppliers(businessId),
    getActivePolicy(businessId),
    getTodaySpentNgn(businessId),
    getOrCreatePilotMode(businessId),
    getActiveSigningGrantByBusinessId(businessId),
  ]);

  let subaccountBalance:
    | {
        availableUsdc: number;
        pendingUsdc: number;
        totalUsdc: number;
      }
    | undefined;
  let subaccountBalanceError: string | undefined;

  if (subaccount) {
    try {
      subaccountBalance = await getSubaccountBalance(subaccount.zendfiSubaccountId);
    } catch (error) {
      subaccountBalanceError =
        error instanceof Error ? error.message : "balance_lookup_failed";
    }
  }

  return NextResponse.json({
    business,
    subaccount,
    suppliers,
    activePolicy,
    spentTodayNgn,
    pilotMode,
    activeSigningGrant,
    subaccountBalance,
    subaccountBalanceError,
  });
}
