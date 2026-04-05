import { createBusiness, initSubaccountForBusiness, listBusinesses } from "@/lib/services/businesses";
import { createPolicyVersion } from "@/lib/services/policies";
import { updatePilotMode } from "@/lib/services/pilot";
import { createSupplier } from "@/lib/services/suppliers";

const PILOT_SEED = [
  {
    name: "Amina Grocers",
    businessType: "retail",
    ownerPhone: "+2348011110001",
    supplierName: "Musa Farms",
    bankId: "OPAY",
    accountNumber: "1000000001",
    accountName: "Musa Farms Ltd",
  },
  {
    name: "Tunde Provisions",
    businessType: "retail",
    ownerPhone: "+2348011110002",
    supplierName: "Kano Wholesales",
    bankId: "MONIEPOINT",
    accountNumber: "1000000002",
    accountName: "Kano Wholesales",
  },
  {
    name: "Ngozi Mart",
    businessType: "retail",
    ownerPhone: "+2348011110003",
    supplierName: "Fresh Depot",
    bankId: "PALMPAY",
    accountNumber: "1000000003",
    accountName: "Fresh Depot Ventures",
  },
] as const;

export async function expandPilotBusinesses(input?: {
  targetCount?: number;
  dryRun?: boolean;
}): Promise<{
  created: string[];
  existing: string[];
  targetCount: number;
  dryRun: boolean;
}> {
  const targetCount = Math.max(1, Math.min(input?.targetCount ?? 3, 10));
  const dryRun = Boolean(input?.dryRun);
  const businesses = await listBusinesses();

  const created: string[] = [];
  const existing: string[] = [];

  for (const seed of PILOT_SEED.slice(0, targetCount)) {
    const match = businesses.find((business) => business.name.toLowerCase() === seed.name.toLowerCase());
    if (match) {
      existing.push(match.id);
      continue;
    }

    if (dryRun) {
      created.push(`dryrun:${seed.name}`);
      continue;
    }

    const business = await createBusiness({
      name: seed.name,
      businessType: seed.businessType,
      ownerPhone: seed.ownerPhone,
    });

    await initSubaccountForBusiness(business.id);
    await createSupplier({
      businessId: business.id,
      supplierName: seed.supplierName,
      bankId: seed.bankId,
      accountNumber: seed.accountNumber,
      accountName: seed.accountName,
    });

    await createPolicyVersion({
      businessId: business.id,
      maxPerTxNgn: 30000,
      dailyCapNgn: 120000,
      approvalThresholdNgn: 25000,
      activeDaysUtc: [0, 1, 2, 3, 4, 5, 6],
      activeStartTimeUtc: "07:00",
      activeEndTimeUtc: "20:00",
    });

    await updatePilotMode({
      businessId: business.id,
      mode: "assisted",
      maxAutoExecutions: 3,
    });

    created.push(business.id);
  }

  return {
    created,
    existing,
    targetCount,
    dryRun,
  };
}
