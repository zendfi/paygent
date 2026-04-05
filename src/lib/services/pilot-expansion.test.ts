import { beforeEach, describe, expect, it } from "vitest";
import { expandPilotBusinesses } from "@/lib/services/pilot-expansion";
import { writeStore } from "@/lib/storage/store";
import type { PaygentStore } from "@/lib/storage/types";

function emptyStore(): PaygentStore {
  return {
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
  };
}

describe("pilot expansion", () => {
  beforeEach(async () => {
    await writeStore(emptyStore());
  });

  it("creates three pilot businesses with setup", async () => {
    const result = await expandPilotBusinesses({ targetCount: 3 });

    expect(result.created.length).toBe(3);
    expect(result.existing.length).toBe(0);
  });

  it("supports dry-run mode", async () => {
    const result = await expandPilotBusinesses({ targetCount: 2, dryRun: true });

    expect(result.created).toHaveLength(2);
    expect(result.created[0]).toContain("dryrun:");
  });
});
