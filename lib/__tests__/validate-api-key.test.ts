import { describe, it, expect, vi, beforeEach } from "vitest";
import { createHash } from "crypto";
import { NextRequest } from "next/server";

vi.mock("@/lib/prisma", () => ({
  prisma: {
    apiKey: {
      findUnique: vi.fn(),
      update: vi.fn(),
    },
  },
}));

import { prisma } from "@/lib/prisma";

beforeEach(() => {
  vi.clearAllMocks();
});

describe("validateApiKey", () => {
  it("returns invalid when no auth header", async () => {
    const { validateApiKey } = await import("@/lib/validate-api-key");
    const req = new NextRequest("http://localhost/api/proxy/test");
    const result = await validateApiKey(req);

    expect(result.valid).toBe(false);
  });

  it("returns invalid for non-Bearer auth", async () => {
    const { validateApiKey } = await import("@/lib/validate-api-key");
    const req = new NextRequest("http://localhost/api/proxy/test", {
      headers: { authorization: "Basic abc123" },
    });
    const result = await validateApiKey(req);

    expect(result.valid).toBe(false);
  });

  it("returns invalid for Bearer without oa- prefix", async () => {
    const { validateApiKey } = await import("@/lib/validate-api-key");
    const req = new NextRequest("http://localhost/api/proxy/test", {
      headers: { authorization: "Bearer some-random-token" },
    });
    const result = await validateApiKey(req);

    expect(result.valid).toBe(false);
  });

  it("returns invalid when key not found in database", async () => {
    (prisma.apiKey.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue(
      null
    );

    const { validateApiKey } = await import("@/lib/validate-api-key");
    const req = new NextRequest("http://localhost/api/proxy/test", {
      headers: { authorization: "Bearer oa-test123" },
    });
    const result = await validateApiKey(req);

    expect(result.valid).toBe(false);
  });

  it("returns invalid when key is inactive", async () => {
    const rawKey = "oa-test123";
    const hash = createHash("sha256").update(rawKey).digest("hex");

    (prisma.apiKey.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue({
      id: "key_1",
      key: hash,
      active: false,
    });

    const { validateApiKey } = await import("@/lib/validate-api-key");
    const req = new NextRequest("http://localhost/api/proxy/test", {
      headers: { authorization: `Bearer ${rawKey}` },
    });
    const result = await validateApiKey(req);

    expect(result.valid).toBe(false);
  });

  it("returns valid and updates lastUsed for active key", async () => {
    const rawKey = "oa-test123";
    const hash = createHash("sha256").update(rawKey).digest("hex");

    (prisma.apiKey.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue({
      id: "key_1",
      key: hash,
      active: true,
    });
    (prisma.apiKey.update as ReturnType<typeof vi.fn>).mockResolvedValue({});

    const { validateApiKey } = await import("@/lib/validate-api-key");
    const req = new NextRequest("http://localhost/api/proxy/test", {
      headers: { authorization: `Bearer ${rawKey}` },
    });
    const result = await validateApiKey(req);

    expect(result.valid).toBe(true);
    expect(result.keyId).toBe("key_1");
    expect(prisma.apiKey.update).toHaveBeenCalledWith({
      where: { id: "key_1" },
      data: { lastUsed: expect.any(Date) },
    });
  });
});
