import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/prisma", () => ({
  prisma: {
    settings: {
      findMany: vi.fn(),
      upsert: vi.fn(),
    },
  },
}));

import { prisma } from "@/lib/prisma";

beforeEach(() => {
  vi.clearAllMocks();
});

describe("GET /api/settings", () => {
  it("returns all settings as key-value object", async () => {
    (prisma.settings.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([
      { key: "logRetentionDays", value: "90" },
      { key: "logStorePrompts", value: "true" },
    ]);

    const { GET } = await import("@/app/api/settings/route");
    const res = await GET();
    const data = await res.json();

    expect(data).toEqual({
      logRetentionDays: "90",
      logStorePrompts: "true",
    });
  });

  it("returns empty object when no settings", async () => {
    (prisma.settings.findMany as ReturnType<typeof vi.fn>).mockResolvedValue(
      []
    );

    const { GET } = await import("@/app/api/settings/route");
    const res = await GET();
    const data = await res.json();

    expect(data).toEqual({});
  });
});

describe("PUT /api/settings", () => {
  it("upserts multiple settings", async () => {
    (prisma.settings.upsert as ReturnType<typeof vi.fn>).mockResolvedValue({});

    const { PUT } = await import("@/app/api/settings/route");
    const req = new Request("http://localhost/api/settings", {
      method: "PUT",
      body: JSON.stringify({
        logRetentionDays: "30",
        logStorePrompts: "false",
      }),
    });
    const res = await PUT(req as any);
    const data = await res.json();

    expect(data).toEqual({ ok: true });
    expect(prisma.settings.upsert).toHaveBeenCalledTimes(2);
    expect(prisma.settings.upsert).toHaveBeenCalledWith({
      where: { key: "logRetentionDays" },
      update: { value: "30" },
      create: { key: "logRetentionDays", value: "30" },
    });
  });
});
