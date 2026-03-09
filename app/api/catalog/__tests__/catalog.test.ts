import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/prisma", () => ({
  prisma: {
    catalogModel: {
      findMany: vi.fn(),
      findFirst: vi.fn(),
      count: vi.fn(),
      upsert: vi.fn(),
    },
  },
}));

vi.mock("@/lib/require-admin", () => ({
  requireAdmin: vi.fn(),
}));

vi.mock("@/lib/catalog-scraper", () => ({
  scrapeOllamaCatalog: vi.fn(),
}));

vi.mock("@/lib/rate-limit", () => ({
  checkRateLimit: vi.fn(),
}));

import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/require-admin";
import { scrapeOllamaCatalog } from "@/lib/catalog-scraper";
import { checkRateLimit } from "@/lib/rate-limit";

beforeEach(() => {
  vi.clearAllMocks();
});

describe("GET /api/catalog", () => {
  it("returns catalog with metadata for any authenticated user", async () => {
    vi.mocked(prisma.catalogModel.count).mockResolvedValue(5);
    vi.mocked(prisma.catalogModel.findMany)
      .mockResolvedValueOnce([
        { id: "llama3", name: "llama3", description: "Test", family: "llama", tags: "8b", pullCount: 1000, lastUpdated: null, cachedAt: new Date() },
      ] as never)
      .mockResolvedValueOnce([{ family: "llama" }] as never);
    vi.mocked(prisma.catalogModel.findFirst).mockResolvedValue({
      cachedAt: new Date("2026-01-01"),
    } as never);

    const { GET } = await import("../route");
    const url = new URL("http://localhost/api/catalog");
    const req = { nextUrl: url } as never;
    const res = await GET(req);
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body).toHaveProperty("models");
    expect(body).toHaveProperty("families");
    expect(body).toHaveProperty("lastRefreshed");
    expect(body).toHaveProperty("total");
  });
});

describe("POST /api/catalog/refresh", () => {
  it("returns 403 for non-admin users", async () => {
    vi.mocked(requireAdmin).mockResolvedValue(null);
    const { POST } = await import("../refresh/route");
    const res = await POST();
    expect(res.status).toBe(403);
  });

  it("returns 429 when rate limited", async () => {
    vi.mocked(requireAdmin).mockResolvedValue({ user: { role: "admin" } } as never);
    vi.mocked(checkRateLimit).mockReturnValue({ allowed: false, remaining: 0, resetMs: 60000 });
    const { POST } = await import("../refresh/route");
    const res = await POST();
    expect(res.status).toBe(429);
  });

  it("refreshes catalog successfully", async () => {
    vi.mocked(requireAdmin).mockResolvedValue({ user: { role: "admin" } } as never);
    vi.mocked(checkRateLimit).mockReturnValue({ allowed: true, remaining: 1, resetMs: 0 });
    vi.mocked(scrapeOllamaCatalog).mockResolvedValue([
      { id: "llama3", name: "llama3", description: "Test", family: "llama", tags: "8b", pullCount: 1000, lastUpdated: "2 days ago" },
    ]);
    vi.mocked(prisma.catalogModel.upsert).mockResolvedValue({} as never);

    const { POST } = await import("../refresh/route");
    const res = await POST();
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.count).toBe(1);
    expect(body).toHaveProperty("timestamp");
    expect(prisma.catalogModel.upsert).toHaveBeenCalledTimes(1);
  });
});
