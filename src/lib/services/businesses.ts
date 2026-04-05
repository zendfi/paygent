import { readStore, writeStore } from "@/lib/storage/store";
import type { Business, Subaccount } from "@/lib/storage/types";
import { createSubaccount } from "@/lib/zendfi/client";

type CreateBusinessInput = {
  name: string;
  businessType: string;
  ownerPhone: string;
};

function makeId(prefix: string): string {
  return `${prefix}_${crypto.randomUUID().replaceAll("-", "").slice(0, 16)}`;
}

function nowIso(): string {
  return new Date().toISOString();
}

export async function listBusinesses(): Promise<Business[]> {
  const store = await readStore();
  return store.businesses;
}

export async function getBusinessById(businessId: string): Promise<Business | undefined> {
  const store = await readStore();
  return store.businesses.find((business) => business.id === businessId);
}

export async function createBusiness(input: CreateBusinessInput): Promise<Business> {
  if (!input.name || !input.businessType || !input.ownerPhone) {
    throw new Error("missing_required_business_fields");
  }

  const store = await readStore();
  const timestamp = nowIso();

  const business: Business = {
    id: makeId("biz"),
    name: input.name,
    businessType: input.businessType,
    ownerPhone: input.ownerPhone,
    status: "active",
    pilotStage: "safe_launch",
    createdAt: timestamp,
    updatedAt: timestamp,
  };

  store.businesses.push(business);
  await writeStore(store);

  return business;
}

export async function getSubaccountByBusinessId(
  businessId: string,
): Promise<Subaccount | undefined> {
  const store = await readStore();
  return store.subaccounts.find((subaccount) => subaccount.businessId === businessId);
}

export async function initSubaccountForBusiness(
  businessId: string,
): Promise<{ business: Business; subaccount: Subaccount; created: boolean }> {
  const store = await readStore();
  const business = store.businesses.find((entry) => entry.id === businessId);

  if (!business) {
    throw new Error("business_not_found");
  }

  const existing = store.subaccounts.find((entry) => entry.businessId === businessId);
  if (existing) {
    return { business, subaccount: existing, created: false };
  }

  const remote = await createSubaccount({
    label: businessId,
    accessMode: "delegated",
    spendLimitUsdc: 500,
    yieldEnabled: false,
  });

  const timestamp = nowIso();
  const subaccount: Subaccount = {
    id: makeId("sa_local"),
    businessId,
    zendfiSubaccountId: remote.id,
    walletAddress: remote.walletAddress,
    status: "active",
    createdAt: timestamp,
    updatedAt: timestamp,
  };

  store.subaccounts.push(subaccount);
  await writeStore(store);

  return { business, subaccount, created: true };
}

export async function setBusinessStatus(
  businessId: string,
  status: Business["status"],
): Promise<Business> {
  const store = await readStore();
  const business = store.businesses.find((entry) => entry.id === businessId);

  if (!business) {
    throw new Error("business_not_found");
  }

  business.status = status;
  business.updatedAt = nowIso();
  await writeStore(store);
  return business;
}
