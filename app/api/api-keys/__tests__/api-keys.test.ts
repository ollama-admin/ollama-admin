import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/prisma", () => ({
  prisma: {
    apiKey: {
      findMany: vi.fn(),
      findUnique: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    },
  },
}));

import { prisma } from "@/lib/prisma";

const mockApiKey = {
  id: "key_1",
  name: "Test Key",
  key: "abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890",
  lastUsed: null,
  active: true,
  createdAt: new Date().toISOString(),
};

beforeEach(() => {
  vi.clearAllMocks();
});

describe("GET /api/api-keys", () => {
  it("returns masked keys", async () => {
    (prisma.apiKey.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([
      mockApiKey,
    ]);

    const { GET } = await import("@/app/api/api-keys/route");
    const res = await GET();
    const data = await res.json();

    expect(data).toHaveLength(1);
    expect(data[0].key).not.toBe(mockApiKey.key);
    expect(data[0].key).toContain("...");
  });

  it("returns empty array when no keys", async () => {
    (prisma.apiKey.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([]);

    const { GET } = await import("@/app/api/api-keys/route");
    const res = await GET();
    const data = await res.json();

    expect(data).toHaveLength(0);
  });
});

describe("POST /api/api-keys", () => {
  it("creates an API key with valid name", async () => {
    (prisma.apiKey.create as ReturnType<typeof vi.fn>).mockResolvedValue({
      id: "key_2",
      name: "My API Key",
      key: "somehash",
      createdAt: new Date().toISOString(),
    });

    const { POST } = await import("@/app/api/api-keys/route");
    const req = new Request("http://localhost/api/api-keys", {
      method: "POST",
      body: JSON.stringify({ name: "My API Key" }),
    });
    const res = await POST(req as any);

    expect(res.status).toBe(201);
    const data = await res.json();
    expect(data.name).toBe("My API Key");
    expect(data.key).toMatch(/^oa-/);
  });

  it("returns 400 when name is missing", async () => {
    const { POST } = await import("@/app/api/api-keys/route");
    const req = new Request("http://localhost/api/api-keys", {
      method: "POST",
      body: JSON.stringify({}),
    });
    const res = await POST(req as any);

    expect(res.status).toBe(400);
  });

  it("returns 400 when name is empty", async () => {
    const { POST } = await import("@/app/api/api-keys/route");
    const req = new Request("http://localhost/api/api-keys", {
      method: "POST",
      body: JSON.stringify({ name: "   " }),
    });
    const res = await POST(req as any);

    expect(res.status).toBe(400);
  });
});

describe("PUT /api/api-keys/[id]", () => {
  it("toggles key active status", async () => {
    (prisma.apiKey.update as ReturnType<typeof vi.fn>).mockResolvedValue({
      id: "key_1",
      active: false,
    });

    const { PUT } = await import("@/app/api/api-keys/[id]/route");
    const req = new Request("http://localhost/api/api-keys/key_1", {
      method: "PUT",
      body: JSON.stringify({ active: false }),
    });
    const res = await PUT(req as any, { params: { id: "key_1" } });

    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.active).toBe(false);
  });

  it("returns 404 for non-existent key", async () => {
    (prisma.apiKey.update as ReturnType<typeof vi.fn>).mockRejectedValue(
      new Error("Not found")
    );

    const { PUT } = await import("@/app/api/api-keys/[id]/route");
    const req = new Request("http://localhost/api/api-keys/nope", {
      method: "PUT",
      body: JSON.stringify({ active: true }),
    });
    const res = await PUT(req as any, { params: { id: "nope" } });

    expect(res.status).toBe(404);
  });
});

describe("DELETE /api/api-keys/[id]", () => {
  it("deletes an API key", async () => {
    (prisma.apiKey.delete as ReturnType<typeof vi.fn>).mockResolvedValue(
      mockApiKey
    );

    const { DELETE } = await import("@/app/api/api-keys/[id]/route");
    const req = new Request("http://localhost/api/api-keys/key_1", {
      method: "DELETE",
    });
    const res = await DELETE(req as any, { params: { id: "key_1" } });

    expect(res.status).toBe(200);
  });

  it("returns 404 for non-existent key", async () => {
    (prisma.apiKey.delete as ReturnType<typeof vi.fn>).mockRejectedValue(
      new Error("Not found")
    );

    const { DELETE } = await import("@/app/api/api-keys/[id]/route");
    const req = new Request("http://localhost/api/api-keys/nope", {
      method: "DELETE",
    });
    const res = await DELETE(req as any, { params: { id: "nope" } });

    expect(res.status).toBe(404);
  });
});
