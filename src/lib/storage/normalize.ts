import type { PaygentStore } from "@/lib/storage/types";

export const EMPTY_STORE: PaygentStore = {
  businesses: [],
  subaccounts: [],
  suppliers: [],
  policyVersions: [],
  dailySpendCounters: [],
  payoutIntents: [],
  payoutExecutions: [],
  activityEvents: [],
  webhookInbox: [],
  retryJobs: [],
  ownerNotifications: [],
  pilotModes: [],
  aiCommands: [],
  alerts: [],
  credentialRotations: [],
  authUsers: [],
};

export function normalizeStore(parsed: Partial<PaygentStore>): PaygentStore {
  return {
    businesses: parsed.businesses ?? [],
    subaccounts: parsed.subaccounts ?? [],
    suppliers: parsed.suppliers ?? [],
    policyVersions: parsed.policyVersions ?? [],
    dailySpendCounters: parsed.dailySpendCounters ?? [],
    payoutIntents: parsed.payoutIntents ?? [],
    payoutExecutions: parsed.payoutExecutions ?? [],
    activityEvents: parsed.activityEvents ?? [],
    webhookInbox: parsed.webhookInbox ?? [],
    retryJobs: parsed.retryJobs ?? [],
    ownerNotifications: parsed.ownerNotifications ?? [],
    pilotModes: parsed.pilotModes ?? [],
    aiCommands: parsed.aiCommands ?? [],
    alerts: parsed.alerts ?? [],
    credentialRotations: parsed.credentialRotations ?? [],
    authUsers: parsed.authUsers ?? [],
  };
}
