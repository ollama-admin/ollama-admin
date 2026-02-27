import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/prisma", () => ({
  prisma: {
    server: {
      findMany: vi.fn(),
      findUnique: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    },
  },
}));

import { prisma } from "@/lib/prisma";

const mockServer = {
  id: "srv_1",
  name: "Local Ollama",
  url: "http://localhost:11434",
  gpuAgentUrl: null,
  active: true,
  createdAt: new Date().toISOString(),
};

beforeEach(() => {
  vi.clearAllMocks();
});

describe("GET /api/servers", () => {
  it("returns all servers", async () => {
    (prisma.server.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([
      mockServer,
    ]);

    const { GET } = await import("@/app/api/servers/route");
    const res = await GET();
    const data = await res.json();

    expect(data).toHaveLength(1);
    expect(data[0].name).toBe("Local Ollama");
  });
});

describe("POST /api/servers", () => {
  it("creates a server with valid data", async () => {
    (prisma.server.create as ReturnType<typeof vi.fn>).mockResolvedValue(
      mockServer
    );

    const { POST } = await import("@/app/api/servers/route");
    const req = new Request("http://localhost/api/servers", {
      method: "POST",
      body: JSON.stringify({
        name: "Local Ollama",
        url: "http://localhost:11434",
      }),
    });
    const res = await POST(req as any);

    expect(res.status).toBe(201);
    const data = await res.json();
    expect(data.name).toBe("Local Ollama");
  });

  it("returns 400 when name is missing", async () => {
    const { POST } = await import("@/app/api/servers/route");
    const req = new Request("http://localhost/api/servers", {
      method: "POST",
      body: JSON.stringify({ url: "http://localhost:11434" }),
    });
    const res = await POST(req as any);

    expect(res.status).toBe(400);
  });

  it("strips trailing slash from URL", async () => {
    (prisma.server.create as ReturnType<typeof vi.fn>).mockImplementation(
      ({ data }) => Promise.resolve({ ...mockServer, ...data })
    );

    const { POST } = await import("@/app/api/servers/route");
    const req = new Request("http://localhost/api/servers", {
      method: "POST",
      body: JSON.stringify({
        name: "Test",
        url: "http://localhost:11434/",
      }),
    });
    await POST(req as any);

    expect(prisma.server.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          url: "http://localhost:11434",
        }),
      })
    );
  });
});

describe("DELETE /api/servers/[id]", () => {
  it("deletes a server", async () => {
    (prisma.server.delete as ReturnType<typeof vi.fn>).mockResolvedValue(
      mockServer
    );

    const { DELETE } = await import("@/app/api/servers/[id]/route");
    const req = new Request("http://localhost/api/servers/srv_1", {
      method: "DELETE",
    });
    const res = await DELETE(req as any, { params: { id: "srv_1" } });

    expect(res.status).toBe(200);
  });

  it("returns 404 for non-existent server", async () => {
    (prisma.server.delete as ReturnType<typeof vi.fn>).mockRejectedValue(
      new Error("Not found")
    );

    const { DELETE } = await import("@/app/api/servers/[id]/route");
    const req = new Request("http://localhost/api/servers/nope", {
      method: "DELETE",
    });
    const res = await DELETE(req as any, { params: { id: "nope" } });

    expect(res.status).toBe(404);
  });
});
