import { describe, it, expect } from "vitest";

describe("constants", () => {
  it("has correct default values", async () => {
    const mod = await import("@/lib/constants");

    expect(mod.LOG_RETENTION_DAYS).toBe(90);
    expect(mod.AUTH_ENABLED).toBe(false);
    expect(mod.GPU_AGENT_ENABLED).toBe(false);
  });
});
