import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/prisma", () => ({
  prisma: {
    user: {
      findMany: vi.fn(),
      findUnique: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
      count: vi.fn(),
    },
  },
}));

vi.mock("@/lib/password", () => ({
  hashPassword: vi.fn().mockResolvedValue("hashed_password"),
}));

vi.mock("@/lib/require-admin", () => ({
  requireAdmin: vi.fn(),
}));

import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/require-admin";

const mockUser = {
  id: "u1",
  username: "testuser",
  role: "user",
  active: true,
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
};

const adminSession = { user: { id: "admin1", role: "admin" } };

beforeEach(() => {
  vi.clearAllMocks();
});

describe("GET /api/users", () => {
  it("returns users when admin", async () => {
    (requireAdmin as ReturnType<typeof vi.fn>).mockResolvedValue(adminSession);
    (prisma.user.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([mockUser]);

    const { GET } = await import("@/app/api/users/route");
    const res = await GET();
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data).toHaveLength(1);
    expect(data[0].username).toBe("testuser");
  });

  it("returns 403 when not admin", async () => {
    (requireAdmin as ReturnType<typeof vi.fn>).mockResolvedValue(null);

    const { GET } = await import("@/app/api/users/route");
    const res = await GET();

    expect(res.status).toBe(403);
  });
});

describe("POST /api/users", () => {
  it("creates user with valid data", async () => {
    (requireAdmin as ReturnType<typeof vi.fn>).mockResolvedValue(adminSession);
    (prisma.user.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue(null);
    (prisma.user.create as ReturnType<typeof vi.fn>).mockResolvedValue(mockUser);

    const { POST } = await import("@/app/api/users/route");
    const req = new Request("http://localhost/api/users", {
      method: "POST",
      body: JSON.stringify({ username: "newuser", password: "securepass123", role: "user" }),
    });
    const res = await POST(req as any);

    expect(res.status).toBe(201);
  });

  it("returns 403 when not admin", async () => {
    (requireAdmin as ReturnType<typeof vi.fn>).mockResolvedValue(null);

    const { POST } = await import("@/app/api/users/route");
    const req = new Request("http://localhost/api/users", {
      method: "POST",
      body: JSON.stringify({ username: "newuser", password: "securepass123" }),
    });
    const res = await POST(req as any);

    expect(res.status).toBe(403);
  });

  it("returns 400 when username too short", async () => {
    (requireAdmin as ReturnType<typeof vi.fn>).mockResolvedValue(adminSession);

    const { POST } = await import("@/app/api/users/route");
    const req = new Request("http://localhost/api/users", {
      method: "POST",
      body: JSON.stringify({ username: "ab", password: "securepass123" }),
    });
    const res = await POST(req as any);

    expect(res.status).toBe(400);
  });

  it("returns 400 when password too short", async () => {
    (requireAdmin as ReturnType<typeof vi.fn>).mockResolvedValue(adminSession);

    const { POST } = await import("@/app/api/users/route");
    const req = new Request("http://localhost/api/users", {
      method: "POST",
      body: JSON.stringify({ username: "newuser", password: "short" }),
    });
    const res = await POST(req as any);

    expect(res.status).toBe(400);
  });

  it("returns 409 when username already exists", async () => {
    (requireAdmin as ReturnType<typeof vi.fn>).mockResolvedValue(adminSession);
    (prisma.user.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue(mockUser);

    const { POST } = await import("@/app/api/users/route");
    const req = new Request("http://localhost/api/users", {
      method: "POST",
      body: JSON.stringify({ username: "testuser", password: "securepass123" }),
    });
    const res = await POST(req as any);

    expect(res.status).toBe(409);
  });

  it("defaults role to user when invalid role provided", async () => {
    (requireAdmin as ReturnType<typeof vi.fn>).mockResolvedValue(adminSession);
    (prisma.user.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue(null);
    (prisma.user.create as ReturnType<typeof vi.fn>).mockResolvedValue({ ...mockUser, role: "user" });

    const { POST } = await import("@/app/api/users/route");
    const req = new Request("http://localhost/api/users", {
      method: "POST",
      body: JSON.stringify({ username: "newuser", password: "securepass123", role: "superadmin" }),
    });
    await POST(req as any);

    expect(prisma.user.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ role: "user" }),
      })
    );
  });
});

describe("PUT /api/users/[id]", () => {
  it("updates user when admin", async () => {
    (requireAdmin as ReturnType<typeof vi.fn>).mockResolvedValue(adminSession);
    (prisma.user.update as ReturnType<typeof vi.fn>).mockResolvedValue({
      ...mockUser,
      role: "admin",
    });

    const { PUT } = await import("@/app/api/users/[id]/route");
    const req = new Request("http://localhost/api/users/u1", {
      method: "PUT",
      body: JSON.stringify({ role: "admin" }),
    });
    const res = await PUT(req as any, { params: { id: "u1" } });

    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.role).toBe("admin");
  });

  it("returns 403 when not admin", async () => {
    (requireAdmin as ReturnType<typeof vi.fn>).mockResolvedValue(null);

    const { PUT } = await import("@/app/api/users/[id]/route");
    const req = new Request("http://localhost/api/users/u1", {
      method: "PUT",
      body: JSON.stringify({ role: "admin" }),
    });
    const res = await PUT(req as any, { params: { id: "u1" } });

    expect(res.status).toBe(403);
  });
});

describe("DELETE /api/users/[id]", () => {
  it("deletes a user when admin", async () => {
    (requireAdmin as ReturnType<typeof vi.fn>).mockResolvedValue(adminSession);
    (prisma.user.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue({
      ...mockUser,
      role: "user",
    });
    (prisma.user.delete as ReturnType<typeof vi.fn>).mockResolvedValue(mockUser);

    const { DELETE } = await import("@/app/api/users/[id]/route");
    const req = new Request("http://localhost/api/users/u1", { method: "DELETE" });
    const res = await DELETE(req as any, { params: { id: "u1" } });

    expect(res.status).toBe(200);
  });

  it("returns 403 when not admin", async () => {
    (requireAdmin as ReturnType<typeof vi.fn>).mockResolvedValue(null);

    const { DELETE } = await import("@/app/api/users/[id]/route");
    const req = new Request("http://localhost/api/users/u1", { method: "DELETE" });
    const res = await DELETE(req as any, { params: { id: "u1" } });

    expect(res.status).toBe(403);
  });

  it("prevents deleting yourself", async () => {
    (requireAdmin as ReturnType<typeof vi.fn>).mockResolvedValue(adminSession);

    const { DELETE } = await import("@/app/api/users/[id]/route");
    const req = new Request("http://localhost/api/users/admin1", { method: "DELETE" });
    const res = await DELETE(req as any, { params: { id: "admin1" } });

    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error).toContain("own account");
  });

  it("prevents deleting last admin", async () => {
    (requireAdmin as ReturnType<typeof vi.fn>).mockResolvedValue(adminSession);
    (prisma.user.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue({
      id: "u2",
      role: "admin",
    });
    (prisma.user.count as ReturnType<typeof vi.fn>).mockResolvedValue(1);

    const { DELETE } = await import("@/app/api/users/[id]/route");
    const req = new Request("http://localhost/api/users/u2", { method: "DELETE" });
    const res = await DELETE(req as any, { params: { id: "u2" } });

    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error).toContain("last admin");
  });
});
