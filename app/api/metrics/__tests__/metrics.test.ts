import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

vi.mock("@/lib/prisma", () => ({
  prisma: {
    log: {
      findMany: vi.fn(),
    },
  },
}));

import { prisma } from "@/lib/prisma";

const makeLogs = () => {
  const now = new Date();
  return [
    {
      id: "log_1",
      model: "llama3",
      createdAt: now,
      promptTokens: 100,
      completionTokens: 200,
      latencyMs: 500,
      statusCode: 200,
      server: { name: "Local" },
    },
    {
      id: "log_2",
      model: "llama3",
      createdAt: now,
      promptTokens: 50,
      completionTokens: 100,
      latencyMs: 300,
      statusCode: 200,
      server: { name: "Local" },
    },
    {
      id: "log_3",
      model: "mistral",
      createdAt: now,
      promptTokens: 80,
      completionTokens: 0,
      latencyMs: 1200,
      statusCode: 500,
      server: { name: "Local" },
    },
  ];
};

beforeEach(() => {
  vi.clearAllMocks();
});

describe("GET /api/metrics", () => {
  it("returns aggregated metrics", async () => {
    (prisma.log.findMany as ReturnType<typeof vi.fn>).mockResolvedValue(
      makeLogs()
    );

    const { GET } = await import("@/app/api/metrics/route");
    const req = new NextRequest("http://localhost/api/metrics?days=7");
    const res = await GET(req);
    const data = await res.json();

    expect(data.totalRequests).toBe(3);
    expect(data.errorCount).toBe(1);
    expect(parseFloat(data.errorRate)).toBeCloseTo(33.3, 0);
  });

  it("calculates tokens by model correctly", async () => {
    (prisma.log.findMany as ReturnType<typeof vi.fn>).mockResolvedValue(
      makeLogs()
    );

    const { GET } = await import("@/app/api/metrics/route");
    const req = new NextRequest("http://localhost/api/metrics?days=7");
    const res = await GET(req);
    const data = await res.json();

    expect(data.tokensByModel["llama3"]).toBe(450); // 100+200+50+100
    expect(data.tokensByModel["mistral"]).toBe(80); // 80+0
  });

  it("calculates average latency by model", async () => {
    (prisma.log.findMany as ReturnType<typeof vi.fn>).mockResolvedValue(
      makeLogs()
    );

    const { GET } = await import("@/app/api/metrics/route");
    const req = new NextRequest("http://localhost/api/metrics?days=7");
    const res = await GET(req);
    const data = await res.json();

    expect(data.avgLatencyByModel["llama3"]).toBe(400); // (500+300)/2
    expect(data.avgLatencyByModel["mistral"]).toBe(1200);
  });

  it("returns top models sorted by usage", async () => {
    (prisma.log.findMany as ReturnType<typeof vi.fn>).mockResolvedValue(
      makeLogs()
    );

    const { GET } = await import("@/app/api/metrics/route");
    const req = new NextRequest("http://localhost/api/metrics?days=7");
    const res = await GET(req);
    const data = await res.json();

    expect(data.topModels[0].model).toBe("llama3");
    expect(data.topModels[0].count).toBe(2);
    expect(data.topModels[1].model).toBe("mistral");
    expect(data.topModels[1].count).toBe(1);
  });

  it("handles empty logs", async () => {
    (prisma.log.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([]);

    const { GET } = await import("@/app/api/metrics/route");
    const req = new NextRequest("http://localhost/api/metrics?days=30");
    const res = await GET(req);
    const data = await res.json();

    expect(data.totalRequests).toBe(0);
    expect(data.errorRate).toBe("0");
    expect(data.topModels).toHaveLength(0);
  });
});
