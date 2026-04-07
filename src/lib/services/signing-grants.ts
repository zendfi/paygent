import { getEnv } from "@/lib/config/env";
import { getActivePolicy } from "@/lib/services/policies";
import { listSuppliers } from "@/lib/services/suppliers";
import { readStore, writeStore } from "@/lib/storage/store";
import type { SigningGrantRecord } from "@/lib/storage/types";
import { createSigningGrant } from "@/lib/zendfi/client";

function makeId(prefix: string): string {
  return `${prefix}_${crypto.randomUUID().replaceAll("-", "").slice(0, 16)}`;
}

function nowIso(): string {
  return new Date().toISOString();
}

function isGrantExpired(grant: SigningGrantRecord, now = Date.now()): boolean {
  return new Date(grant.expiresAt).getTime() <= now || grant.usedCount >= grant.maxUses;
}

export async function getActiveSigningGrantByBusinessId(
  businessId: string,
): Promise<SigningGrantRecord | undefined> {
  const store = await readStore();
  const now = Date.now();

  return (store.signingGrants ?? []).find(
    (grant) => grant.businessId === businessId && grant.status === "active" && !isGrantExpired(grant, now),
  );
}

export async function revokeSigningGrantsForBusiness(
  businessId: string,
  reason: string,
): Promise<number> {
  const store = await readStore();
  const now = nowIso();
  let revoked = 0;

  for (const grant of store.signingGrants ?? []) {
    if (grant.businessId !== businessId || grant.status !== "active") {
      continue;
    }
    grant.status = "revoked";
    grant.reason = reason;
    grant.updatedAt = now;
    revoked += 1;
  }

  if (revoked > 0) {
    await writeStore(store);
  }

  return revoked;
}

export async function ensureActiveSigningGrantForBusiness(input: {
  businessId: string;
  requestedBy: string;
  reason: string;
}): Promise<SigningGrantRecord> {
  const existing = await getActiveSigningGrantByBusinessId(input.businessId);
  if (existing) {
    return existing;
  }

  const store = await readStore();
  const business = store.businesses.find((entry) => entry.id === input.businessId);
  if (!business) {
    throw new Error("business_not_found");
  }

  const subaccount = store.subaccounts.find((entry) => entry.businessId === input.businessId);
  if (!subaccount) {
    throw new Error("subaccount_not_initialized");
  }

  const policy = await getActivePolicy(input.businessId);
  if (!policy) {
    throw new Error("active_policy_not_found");
  }

  const suppliers = await listSuppliers(input.businessId);
  const allowedBankIds = Array.from(new Set(suppliers.filter((item) => item.enabled).map((item) => item.bankId)));
  const allowedAccountNumbers = Array.from(
    new Set(suppliers.filter((item) => item.enabled).map((item) => item.accountNumber)),
  );

  const env = getEnv();
  const remote = await createSigningGrant({
    subaccountId: subaccount.zendfiSubaccountId,
    perTxLimitNgn: policy.maxPerTxNgn,
    dailyCapNgn: policy.dailyCapNgn,
    approvalThresholdNgn: policy.approvalThresholdNgn,
    activeDaysUtc: policy.activeDaysUtc,
    activeStartTimeUtc: policy.activeStartTimeUtc,
    activeEndTimeUtc: policy.activeEndTimeUtc,
    allowedBankIds,
    allowedAccountNumbers,
    maxUses: env.signingGrantMaxUses,
    ttlSeconds: env.signingGrantTtlSeconds,
    requestedBy: input.requestedBy,
    reason: input.reason,
  });

  const timestamp = nowIso();
  const grant: SigningGrantRecord = {
    id: makeId("sg_local"),
    businessId: input.businessId,
    subaccountId: subaccount.id,
    zendfiSubaccountId: subaccount.zendfiSubaccountId,
    zendfiSigningGrantId: remote.id,
    status: "active",
    perTxLimitNgn: policy.maxPerTxNgn,
    dailyCapNgn: policy.dailyCapNgn,
    maxUses: env.signingGrantMaxUses,
    usedCount: 0,
    approvalThresholdNgn: policy.approvalThresholdNgn,
    activeDaysUtc: [...policy.activeDaysUtc],
    activeStartTimeUtc: policy.activeStartTimeUtc,
    activeEndTimeUtc: policy.activeEndTimeUtc,
    allowedBankIds,
    allowedAccountNumbers,
    requestedBy: input.requestedBy,
    reason: input.reason,
    expiresAt: remote.expiresAt,
    createdAt: timestamp,
    updatedAt: timestamp,
  };

  store.signingGrants = store.signingGrants ?? [];
  store.signingGrants.push(grant);
  subaccount.activeSigningGrantId = grant.id;
  subaccount.updatedAt = timestamp;
  await writeStore(store);

  return grant;
}

export async function consumeSigningGrantUse(grantId: string): Promise<void> {
  const store = await readStore();
  const grant = (store.signingGrants ?? []).find((entry) => entry.id === grantId);
  if (!grant) {
    return;
  }

  grant.usedCount += 1;
  grant.updatedAt = nowIso();
  if (grant.usedCount >= grant.maxUses || new Date(grant.expiresAt).getTime() <= Date.now()) {
    grant.status = "expired";
  }

  await writeStore(store);
}
