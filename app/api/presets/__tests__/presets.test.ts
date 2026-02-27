import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/prisma", () => ({
  prisma: {
    preset: {
      findMany: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    },
  },
}));

import { prisma } from "@/lib/prisma";

const mockPreset = {
  id: "preset_1",
  name: "Creative",
  temperature: 0.9,
  topK: 40,
  topP: 0.95,
  numCtx: 4096,
  numPredict: 512,
  systemPrompt: "You are a creative assistant.",
  createdAt: new Date().toISOString(),
};

beforeEach(() => {
  vi.clearAllMocks();
});

describe("GET /api/presets", () => {
  it("returns all presets", async () => {
    (prisma.preset.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([
      mockPreset,
    ]);

    const { GET } = await import("@/app/api/presets/route");
    const res = await GET();
    const data = await res.json();

    expect(data).toHaveLength(1);
    expect(data[0].name).toBe("Creative");
  });

  it("returns empty array when no presets", async () => {
    (prisma.preset.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([]);

    const { GET } = await import("@/app/api/presets/route");
    const res = await GET();
    const data = await res.json();

    expect(data).toHaveLength(0);
  });
});

describe("POST /api/presets", () => {
  it("creates a preset with valid data", async () => {
    (prisma.preset.create as ReturnType<typeof vi.fn>).mockResolvedValue(
      mockPreset
    );

    const { POST } = await import("@/app/api/presets/route");
    const req = new Request("http://localhost/api/presets", {
      method: "POST",
      body: JSON.stringify({ name: "Creative", temperature: 0.9, topK: 40 }),
    });
    const res = await POST(req as any);

    expect(res.status).toBe(201);
    const data = await res.json();
    expect(data.name).toBe("Creative");
  });

  it("returns 400 when name is missing", async () => {
    const { POST } = await import("@/app/api/presets/route");
    const req = new Request("http://localhost/api/presets", {
      method: "POST",
      body: JSON.stringify({ temperature: 0.9 }),
    });
    const res = await POST(req as any);

    expect(res.status).toBe(400);
  });

  it("returns 400 when name is empty string", async () => {
    const { POST } = await import("@/app/api/presets/route");
    const req = new Request("http://localhost/api/presets", {
      method: "POST",
      body: JSON.stringify({ name: "   " }),
    });
    const res = await POST(req as any);

    expect(res.status).toBe(400);
  });
});

describe("PUT /api/presets/[id]", () => {
  it("updates a preset", async () => {
    const updated = { ...mockPreset, temperature: 0.5 };
    (prisma.preset.update as ReturnType<typeof vi.fn>).mockResolvedValue(
      updated
    );

    const { PUT } = await import("@/app/api/presets/[id]/route");
    const req = new Request("http://localhost/api/presets/preset_1", {
      method: "PUT",
      body: JSON.stringify({ name: "Creative", temperature: 0.5 }),
    });
    const res = await PUT(req as any, { params: { id: "preset_1" } });

    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.temperature).toBe(0.5);
  });

  it("returns 404 for non-existent preset", async () => {
    (prisma.preset.update as ReturnType<typeof vi.fn>).mockRejectedValue(
      new Error("Not found")
    );

    const { PUT } = await import("@/app/api/presets/[id]/route");
    const req = new Request("http://localhost/api/presets/nope", {
      method: "PUT",
      body: JSON.stringify({ name: "X" }),
    });
    const res = await PUT(req as any, { params: { id: "nope" } });

    expect(res.status).toBe(404);
  });
});

describe("DELETE /api/presets/[id]", () => {
  it("deletes a preset", async () => {
    (prisma.preset.delete as ReturnType<typeof vi.fn>).mockResolvedValue(
      mockPreset
    );

    const { DELETE } = await import("@/app/api/presets/[id]/route");
    const req = new Request("http://localhost/api/presets/preset_1", {
      method: "DELETE",
    });
    const res = await DELETE(req as any, { params: { id: "preset_1" } });

    expect(res.status).toBe(200);
  });

  it("returns 404 for non-existent preset", async () => {
    (prisma.preset.delete as ReturnType<typeof vi.fn>).mockRejectedValue(
      new Error("Not found")
    );

    const { DELETE } = await import("@/app/api/presets/[id]/route");
    const req = new Request("http://localhost/api/presets/nope", {
      method: "DELETE",
    });
    const res = await DELETE(req as any, { params: { id: "nope" } });

    expect(res.status).toBe(404);
  });
});
