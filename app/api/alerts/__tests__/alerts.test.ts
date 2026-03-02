import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/prisma", () => ({
  prisma: {
    alert: {
      findMany: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    },
    log: {
      findMany: vi.fn(),
    },
    server: {
      findMany: vi.fn(),
    },
  },
}));

import { prisma } from "@/lib/prisma";

const mockAlert = {
  id: "alert_1",
  type: "error_rate",
  threshold: 10,
  enabled: true,
  createdAt: new Date().toISOString(),
};

beforeEach(() => {
  vi.clearAllMocks();
});

describe("GET /api/alerts", () => {
  it("returns all alerts", async () => {
    (prisma.alert.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([
      mockAlert,
    ]);

    const { GET } = await import("@/app/api/alerts/route");
    const res = await GET();
    const data = await res.json();

    expect(data).toHaveLength(1);
    expect(data[0].type).toBe("error_rate");
  });

  it("returns empty array when no alerts", async () => {
    (prisma.alert.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([]);

    const { GET } = await import("@/app/api/alerts/route");
    const res = await GET();
    const data = await res.json();

    expect(data).toHaveLength(0);
  });
});

describe("POST /api/alerts", () => {
  it("creates an alert with valid data", async () => {
    (prisma.alert.create as ReturnType<typeof vi.fn>).mockResolvedValue(
      mockAlert
    );

    const { POST } = await import("@/app/api/alerts/route");
    const req = new Request("http://localhost/api/alerts", {
      method: "POST",
      body: JSON.stringify({ type: "error_rate", threshold: 10 }),
    });
    const res = await POST(req as any);

    expect(res.status).toBe(201);
    const data = await res.json();
    expect(data.type).toBe("error_rate");
  });

  it("returns 400 when type is missing", async () => {
    const { POST } = await import("@/app/api/alerts/route");
    const req = new Request("http://localhost/api/alerts", {
      method: "POST",
      body: JSON.stringify({ threshold: 10 }),
    });
    const res = await POST(req as any);

    expect(res.status).toBe(400);
  });

  it("returns 400 for invalid type", async () => {
    const { POST } = await import("@/app/api/alerts/route");
    const req = new Request("http://localhost/api/alerts", {
      method: "POST",
      body: JSON.stringify({ type: "invalid_type", threshold: 10 }),
    });
    const res = await POST(req as any);

    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error).toContain("type must be one of");
  });

  it("returns 400 when threshold is missing", async () => {
    const { POST } = await import("@/app/api/alerts/route");
    const req = new Request("http://localhost/api/alerts", {
      method: "POST",
      body: JSON.stringify({ type: "error_rate" }),
    });
    const res = await POST(req as any);

    expect(res.status).toBe(400);
  });
});

describe("PUT /api/alerts/[id]", () => {
  it("updates an alert threshold", async () => {
    const updated = { ...mockAlert, threshold: 20 };
    (prisma.alert.update as ReturnType<typeof vi.fn>).mockResolvedValue(
      updated
    );

    const { PUT } = await import("@/app/api/alerts/[id]/route");
    const req = new Request("http://localhost/api/alerts/alert_1", {
      method: "PUT",
      body: JSON.stringify({ threshold: 20 }),
    });
    const res = await PUT(req as any, { params: { id: "alert_1" } });

    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.threshold).toBe(20);
  });

  it("returns 404 for non-existent alert", async () => {
    (prisma.alert.update as ReturnType<typeof vi.fn>).mockRejectedValue(
      new Error("Not found")
    );

    const { PUT } = await import("@/app/api/alerts/[id]/route");
    const req = new Request("http://localhost/api/alerts/nope", {
      method: "PUT",
      body: JSON.stringify({ threshold: 5 }),
    });
    const res = await PUT(req as any, { params: { id: "nope" } });

    expect(res.status).toBe(404);
  });
});

describe("DELETE /api/alerts/[id]", () => {
  it("deletes an alert", async () => {
    (prisma.alert.delete as ReturnType<typeof vi.fn>).mockResolvedValue(
      mockAlert
    );

    const { DELETE } = await import("@/app/api/alerts/[id]/route");
    const req = new Request("http://localhost/api/alerts/alert_1", {
      method: "DELETE",
    });
    const res = await DELETE(req as any, { params: { id: "alert_1" } });

    expect(res.status).toBe(200);
  });

  it("returns 404 for non-existent alert", async () => {
    (prisma.alert.delete as ReturnType<typeof vi.fn>).mockRejectedValue(
      new Error("Not found")
    );

    const { DELETE } = await import("@/app/api/alerts/[id]/route");
    const req = new Request("http://localhost/api/alerts/nope", {
      method: "DELETE",
    });
    const res = await DELETE(req as any, { params: { id: "nope" } });

    expect(res.status).toBe(404);
  });
});

describe("GET /api/alerts/check", () => {
  it("returns empty array when no enabled alerts", async () => {
    (prisma.alert.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([]);

    const { GET } = await import("@/app/api/alerts/check/route");
    const res = await GET();
    const data = await res.json();

    expect(data).toHaveLength(0);
  });

  it("evaluates error_rate alert against logs", async () => {
    (prisma.alert.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([
      { id: "a1", type: "error_rate", threshold: 10, enabled: true },
    ]);
    (prisma.log.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([
      { statusCode: 200 },
      { statusCode: 200 },
      { statusCode: 500 },
      { statusCode: 500 },
    ]);

    const { GET } = await import("@/app/api/alerts/check/route");
    const res = await GET();
    const data = await res.json();

    expect(data).toHaveLength(1);
    expect(data[0].type).toBe("error_rate");
    expect(data[0].triggered).toBe(true);
    expect(data[0].currentValue).toBe(50);
  });

  it("evaluates latency alert against logs", async () => {
    (prisma.alert.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([
      { id: "a2", type: "latency", threshold: 500, enabled: true },
    ]);
    (prisma.log.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([
      { latencyMs: 100 },
      { latencyMs: 200 },
      { latencyMs: 300 },
    ]);

    const { GET } = await import("@/app/api/alerts/check/route");
    const res = await GET();
    const data = await res.json();

    expect(data).toHaveLength(1);
    expect(data[0].type).toBe("latency");
    expect(data[0].triggered).toBe(false);
    expect(data[0].currentValue).toBe(200);
  });
});
