import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/prisma", () => ({
  prisma: {
    log: {
      findMany: vi.fn(),
      count: vi.fn(),
    },
    server: {
      findMany: vi.fn(),
    },
  },
}));

vi.mock("@/lib/logger", () => ({
  logger: { warn: vi.fn(), info: vi.fn() },
}));

// Mock fetch for server health/ps/gpu calls
const mockFetch = vi.fn();
vi.stubGlobal("fetch", mockFetch);

import { prisma } from "@/lib/prisma";

const now = new Date();

const makeLog = (overrides: Partial<{
  model: string;
  statusCode: number;
  latencyMs: number;
  promptTokens: number;
  completionTokens: number;
  createdAt: Date;
}> = {}) => ({
  id: "log_1",
  model: "llama3.1:8b",
  statusCode: 200,
  latencyMs: 500,
  promptTokens: 100,
  completionTokens: 200,
  createdAt: now,
  ...overrides,
});

const mockServer = {
  id: "srv_1",
  name: "Local",
  url: "http://localhost:11434",
  gpuAgentUrl: null,
};

beforeEach(() => {
  vi.clearAllMocks();
  // Default: server offline (fetch rejects)
  mockFetch.mockRejectedValue(new Error("Connection refused"));
});

describe("GET /api/dashboard", () => {
  it("returns correct KPIs for today's logs", async () => {
    const logs = [
      makeLog({ model: "llama3.1:8b", latencyMs: 400, promptTokens: 100, completionTokens: 200 }),
      makeLog({ model: "llama3.1:8b", latencyMs: 600, promptTokens: 50, completionTokens: 100 }),
      makeLog({ model: "mistral", latencyMs: 1200, statusCode: 500, promptTokens: 80, completionTokens: 0 }),
    ];

    (prisma.log.findMany as ReturnType<typeof vi.fn>).mockResolvedValue(logs);
    (prisma.log.count as ReturnType<typeof vi.fn>).mockResolvedValue(2);
    (prisma.server.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([mockServer]);

    const { GET } = await import("@/app/api/dashboard/route");
    const res = await GET();
    const data = await res.json();

    expect(data.kpis.requestsToday).toBe(3);
    expect(data.kpis.requestsYesterday).toBe(2);
    expect(data.kpis.errorCount).toBe(1);
    expect(parseFloat(data.kpis.errorRate)).toBeCloseTo(33.3, 0);
    expect(data.kpis.tokensToday).toBe(530); // (100+200) + (50+100) + (80+0)
    expect(data.kpis.avgLatencyMs).toBe(733); // (400+600+1200)/3
  });

  it("calculates p95 latency correctly", async () => {
    const latencies = [100, 200, 300, 400, 500, 600, 700, 800, 900, 1000, 5000];
    const logs = latencies.map((l) => makeLog({ latencyMs: l }));

    (prisma.log.findMany as ReturnType<typeof vi.fn>).mockResolvedValue(logs);
    (prisma.log.count as ReturnType<typeof vi.fn>).mockResolvedValue(0);
    (prisma.server.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([]);

    const { GET } = await import("@/app/api/dashboard/route");
    const res = await GET();
    const data = await res.json();

    // p95 index = floor(11 * 0.95) = 10 => 5000
    expect(data.kpis.p95LatencyMs).toBe(5000);
  });

  it("returns top 5 models sorted by usage", async () => {
    const logs = [
      ...Array(5).fill(null).map(() => makeLog({ model: "llama3.1:8b" })),
      ...Array(3).fill(null).map(() => makeLog({ model: "mistral" })),
      ...Array(2).fill(null).map(() => makeLog({ model: "codellama" })),
      ...Array(1).fill(null).map(() => makeLog({ model: "phi3" })),
      ...Array(1).fill(null).map(() => makeLog({ model: "gemma" })),
      ...Array(1).fill(null).map(() => makeLog({ model: "deepseek" })),
    ];

    (prisma.log.findMany as ReturnType<typeof vi.fn>).mockResolvedValue(logs);
    (prisma.log.count as ReturnType<typeof vi.fn>).mockResolvedValue(0);
    (prisma.server.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([]);

    const { GET } = await import("@/app/api/dashboard/route");
    const res = await GET();
    const data = await res.json();

    expect(data.topModels).toHaveLength(5);
    expect(data.topModels[0]).toEqual({ model: "llama3.1:8b", count: 5 });
    expect(data.topModels[1]).toEqual({ model: "mistral", count: 3 });
  });

  it("returns 24 hourly buckets always", async () => {
    (prisma.log.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([]);
    (prisma.log.count as ReturnType<typeof vi.fn>).mockResolvedValue(0);
    (prisma.server.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([]);

    const { GET } = await import("@/app/api/dashboard/route");
    const res = await GET();
    const data = await res.json();

    expect(data.requestsPerHour).toHaveLength(24);
    data.requestsPerHour.forEach((b: { hour: string; count: number }) => {
      expect(b.count).toBe(0);
    });
  });

  it("handles empty state gracefully", async () => {
    (prisma.log.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([]);
    (prisma.log.count as ReturnType<typeof vi.fn>).mockResolvedValue(0);
    (prisma.server.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([]);

    const { GET } = await import("@/app/api/dashboard/route");
    const res = await GET();
    const data = await res.json();

    expect(data.kpis.requestsToday).toBe(0);
    expect(data.kpis.tokensToday).toBe(0);
    expect(data.kpis.avgLatencyMs).toBe(0);
    expect(data.kpis.errorRate).toBe("0.0");
    expect(data.topModels).toHaveLength(0);
    expect(data.servers).toHaveLength(0);
  });

  it("marks server as online when health check succeeds", async () => {
    (prisma.log.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([]);
    (prisma.log.count as ReturnType<typeof vi.fn>).mockResolvedValue(0);
    (prisma.server.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([mockServer]);

    mockFetch
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ version: "0.5.1" }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ models: [] }),
      });

    const { GET } = await import("@/app/api/dashboard/route");
    const res = await GET();
    const data = await res.json();

    expect(data.servers[0].status).toBe("online");
    expect(data.servers[0].version).toBe("0.5.1");
    expect(data.kpis.serversOnline).toBe(1);
  });

  it("marks server as offline when health check fails", async () => {
    (prisma.log.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([]);
    (prisma.log.count as ReturnType<typeof vi.fn>).mockResolvedValue(0);
    (prisma.server.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([mockServer]);

    mockFetch.mockRejectedValue(new Error("Connection refused"));

    const { GET } = await import("@/app/api/dashboard/route");
    const res = await GET();
    const data = await res.json();

    expect(data.servers[0].status).toBe("offline");
    expect(data.kpis.serversOnline).toBe(0);
  });
});
