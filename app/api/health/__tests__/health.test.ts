import { describe, it, expect, vi, beforeEach } from "vitest";
import { GET } from "../route";

vi.mock("@/lib/prisma", () => ({
  prisma: {
    $queryRaw: vi.fn(),
  },
}));

import { prisma } from "@/lib/prisma";

describe("GET /api/health", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns ok status when database is healthy", async () => {
    vi.mocked(prisma.$queryRaw).mockResolvedValue([{ "1": 1 }]);

    const response = await GET();
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.status).toBe("ok");
    expect(data.checks.database).toBe("ok");
    expect(typeof data.checks.uptime).toBe("number");
    expect(data.timestamp).toBeDefined();
  });

  it("returns error status when database fails", async () => {
    vi.mocked(prisma.$queryRaw).mockRejectedValue(new Error("DB connection failed"));

    const response = await GET();
    const data = await response.json();

    expect(response.status).toBe(503);
    expect(data.status).toBe("error");
    expect(data.checks.database).toBe("error");
  });

  it("includes version in response", async () => {
    vi.mocked(prisma.$queryRaw).mockResolvedValue([{ "1": 1 }]);

    const response = await GET();
    const data = await response.json();

    expect(data.version).toBeDefined();
  });
});
