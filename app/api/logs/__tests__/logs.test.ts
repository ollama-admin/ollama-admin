import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

vi.mock("@/lib/prisma", () => ({
  prisma: {
    log: {
      findMany: vi.fn(),
      count: vi.fn(),
      deleteMany: vi.fn(),
    },
  },
}));

import { prisma } from "@/lib/prisma";

beforeEach(() => {
  vi.clearAllMocks();
});

describe("DELETE /api/logs", () => {
  it("purges logs before a given date", async () => {
    (prisma.log.deleteMany as ReturnType<typeof vi.fn>).mockResolvedValue({
      count: 42,
    });

    const { DELETE } = await import("@/app/api/logs/route");
    const req = new NextRequest(
      "http://localhost/api/logs?before=2025-01-01T00:00:00Z",
      { method: "DELETE" }
    );
    const res = await DELETE(req);
    const data = await res.json();

    expect(data.deleted).toBe(42);
    expect(prisma.log.deleteMany).toHaveBeenCalledWith({
      where: { createdAt: { lt: new Date("2025-01-01T00:00:00Z") } },
    });
  });

  it("returns 400 when before parameter is missing", async () => {
    const { DELETE } = await import("@/app/api/logs/route");
    const req = new NextRequest("http://localhost/api/logs", {
      method: "DELETE",
    });
    const res = await DELETE(req);

    expect(res.status).toBe(400);
  });
});
