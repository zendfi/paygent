import { describe, expect, it } from "vitest";
import { runLoadCheck } from "@/lib/services/load-check";

describe("load check", () => {
  it("returns runtime metrics", async () => {
    const result = await runLoadCheck({ iterations: 20 });

    expect(result.iterations).toBe(20);
    expect(result.durationMs).toBeGreaterThanOrEqual(0);
    expect(result.readStoreP95Ms).toBeGreaterThanOrEqual(0);
    expect(result.policyEvalP95Ms).toBeGreaterThanOrEqual(0);
  });
});
