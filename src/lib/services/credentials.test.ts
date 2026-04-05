import { beforeEach, describe, expect, it } from "vitest";
import {
  completeCredentialRotation,
  listCredentialRotations,
  requestCredentialRotation,
} from "@/lib/services/credentials";
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

describe("credential rotations", () => {
  beforeEach(async () => {
    await writeStore(emptyStore());
  });

  it("requests and lists rotations", async () => {
    const record = await requestCredentialRotation({
      credentialType: "zendfi_webhook_secret",
      requestedBy: "ops-owner",
      reason: "scheduled_monthly_rotation",
    });

    const list = await listCredentialRotations();
    expect(list[0]?.id).toBe(record.id);
    expect(list[0]?.status).toBe("pending");
  });

  it("completes rotation and sets next due", async () => {
    const record = await requestCredentialRotation({
      credentialType: "owner_api_token",
      requestedBy: "ops-owner",
      reason: "security_remediation",
    });

    const completed = await completeCredentialRotation({
      rotationId: record.id,
      notes: "rotated_and_verified",
    });

    expect(completed.status).toBe("completed");
    expect(completed.completedAt).toBeTruthy();
    expect(completed.nextDueAt).toBeTruthy();
  });
});
