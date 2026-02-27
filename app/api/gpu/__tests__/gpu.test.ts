import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/prisma", () => ({
  prisma: {
    server: {
      findMany: vi.fn(),
    },
  },
}));

const fetchMock = vi.fn();
vi.stubGlobal("fetch", fetchMock);

import { prisma } from "@/lib/prisma";

const mockServer = {
  id: "srv_1",
  name: "Local Ollama",
  url: "http://localhost:11434",
  gpuAgentUrl: null,
  active: true,
};

const mockServerWithGpu = {
  ...mockServer,
  id: "srv_2",
  name: "GPU Server",
  gpuAgentUrl: "http://localhost:9100",
};

beforeEach(() => {
  vi.clearAllMocks();
});

describe("GET /api/gpu", () => {
  it("returns running models from server", async () => {
    (prisma.server.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([
      mockServer,
    ]);
    fetchMock.mockResolvedValue({
      ok: true,
      json: () =>
        Promise.resolve({
          models: [
            { name: "llama3:latest", size: 4_000_000_000, size_vram: 3_500_000_000, expires_at: "2025-12-31T00:00:00Z" },
          ],
        }),
    });

    const { GET } = await import("@/app/api/gpu/route");
    const res = await GET();
    const data = await res.json();

    expect(data).toHaveLength(1);
    expect(data[0].serverName).toBe("Local Ollama");
    expect(data[0].runningModels).toHaveLength(1);
    expect(data[0].runningModels[0].name).toBe("llama3:latest");
  });

  it("handles server connection error", async () => {
    (prisma.server.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([
      mockServer,
    ]);
    fetchMock.mockRejectedValue(new Error("Connection refused"));

    const { GET } = await import("@/app/api/gpu/route");
    const res = await GET();
    const data = await res.json();

    expect(data[0].error).toBe("Could not connect to Ollama server");
    expect(data[0].runningModels).toHaveLength(0);
  });

  it("fetches GPU info from gpu-agent when available", async () => {
    (prisma.server.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([
      mockServerWithGpu,
    ]);

    fetchMock.mockImplementation((url: string) => {
      if (url.includes("/api/ps")) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ models: [] }),
        });
      }
      if (url.includes("/gpu")) {
        return Promise.resolve({
          ok: true,
          json: () =>
            Promise.resolve([
              {
                name: "RTX 4090",
                memoryTotal: 24_000_000_000,
                memoryUsed: 8_000_000_000,
                memoryFree: 16_000_000_000,
                temperature: 65,
                utilization: 45,
              },
            ]),
        });
      }
      return Promise.reject(new Error("Unknown URL"));
    });

    const { GET } = await import("@/app/api/gpu/route");
    const res = await GET();
    const data = await res.json();

    expect(data[0].gpuInfo).toHaveLength(1);
    expect(data[0].gpuInfo[0].name).toBe("RTX 4090");
    expect(data[0].gpuInfo[0].temperature).toBe(65);
  });

  it("returns empty array when no active servers", async () => {
    (prisma.server.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([]);

    const { GET } = await import("@/app/api/gpu/route");
    const res = await GET();
    const data = await res.json();

    expect(data).toHaveLength(0);
  });
});
