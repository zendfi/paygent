import { beforeEach, describe, expect, it } from "vitest";
import { createSessionToken, verifySessionToken } from "@/lib/auth/session";

describe("auth session token", () => {
  beforeEach(() => {
    process.env.PAYGENT_AUTH_SESSION_SECRET = "test_session_secret_123";
  });

  it("round-trips emails containing dots", async () => {
    const token = await createSessionToken("owner.ops@paygent.zendfi.tech");
    const session = await verifySessionToken(token);

    expect(session).toBeTruthy();
    expect(session?.email).toBe("owner.ops@paygent.zendfi.tech");
  });

  it("rejects malformed token", async () => {
    const session = await verifySessionToken("bad.token");
    expect(session).toBeNull();
  });
});
