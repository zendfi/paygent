import { readStore, writeStore } from "@/lib/storage/store";
import type { PolicyVersion } from "@/lib/storage/types";

type CreatePolicyInput = {
  businessId: string;
  maxPerTxNgn: number;
  dailyCapNgn: number;
  approvalThresholdNgn: number;
  activeDaysUtc: number[];
  activeStartTimeUtc: string;
  activeEndTimeUtc: string;
};

function makeId(prefix: string): string {
  return `${prefix}_${crypto.randomUUID().replaceAll("-", "").slice(0, 16)}`;
}

function nowIso(): string {
  return new Date().toISOString();
}

function validateTime(value: string): boolean {
  return /^([01]\d|2[0-3]):([0-5]\d)$/.test(value);
}

function validateInput(input: CreatePolicyInput): void {
  if (input.maxPerTxNgn <= 0 || input.dailyCapNgn <= 0 || input.approvalThresholdNgn < 0) {
    throw new Error("invalid_policy_amounts");
  }

  if (input.maxPerTxNgn > input.dailyCapNgn) {
    throw new Error("max_per_tx_cannot_exceed_daily_cap");
  }

  if (!Array.isArray(input.activeDaysUtc) || input.activeDaysUtc.length === 0) {
    throw new Error("active_days_required");
  }

  if (!input.activeDaysUtc.every((day) => Number.isInteger(day) && day >= 0 && day <= 6)) {
    throw new Error("invalid_active_days");
  }

  if (!validateTime(input.activeStartTimeUtc) || !validateTime(input.activeEndTimeUtc)) {
    throw new Error("invalid_active_time_window");
  }
}

export async function listPolicies(businessId: string): Promise<PolicyVersion[]> {
  const store = await readStore();
  return store.policyVersions.filter((policy) => policy.businessId === businessId);
}

export async function getActivePolicy(
  businessId: string,
): Promise<PolicyVersion | undefined> {
  const store = await readStore();
  return store.policyVersions.find(
    (policy) => policy.businessId === businessId && policy.status === "active",
  );
}

export async function createPolicyVersion(input: CreatePolicyInput): Promise<PolicyVersion> {
  validateInput(input);

  const store = await readStore();

  const businessExists = store.businesses.some((business) => business.id === input.businessId);
  if (!businessExists) {
    throw new Error("business_not_found");
  }

  for (const policy of store.policyVersions) {
    if (policy.businessId === input.businessId && policy.status === "active") {
      policy.status = "archived";
    }
  }

  const timestamp = nowIso();
  const policy: PolicyVersion = {
    id: makeId("pol"),
    businessId: input.businessId,
    status: "active",
    maxPerTxNgn: input.maxPerTxNgn,
    dailyCapNgn: input.dailyCapNgn,
    approvalThresholdNgn: input.approvalThresholdNgn,
    activeDaysUtc: [...input.activeDaysUtc],
    activeStartTimeUtc: input.activeStartTimeUtc,
    activeEndTimeUtc: input.activeEndTimeUtc,
    createdAt: timestamp,
    activatedAt: timestamp,
  };

  store.policyVersions.push(policy);
  await writeStore(store);

  return policy;
}
