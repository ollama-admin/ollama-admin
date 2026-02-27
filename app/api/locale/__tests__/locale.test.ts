import { describe, it, expect, vi, beforeEach } from "vitest";

beforeEach(() => {
  vi.clearAllMocks();
});

describe("POST /api/locale", () => {
  it("sets locale cookie for valid locale", async () => {
    const { POST } = await import("@/app/api/locale/route");
    const req = new Request("http://localhost/api/locale", {
      method: "POST",
      body: JSON.stringify({ locale: "es" }),
    });
    const res = await POST(req as any);

    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.locale).toBe("es");

    const setCookie = res.headers.get("set-cookie");
    expect(setCookie).toContain("locale=es");
  });

  it("sets locale cookie for English", async () => {
    const { POST } = await import("@/app/api/locale/route");
    const req = new Request("http://localhost/api/locale", {
      method: "POST",
      body: JSON.stringify({ locale: "en" }),
    });
    const res = await POST(req as any);

    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.locale).toBe("en");
  });

  it("returns 400 for unsupported locale", async () => {
    const { POST } = await import("@/app/api/locale/route");
    const req = new Request("http://localhost/api/locale", {
      method: "POST",
      body: JSON.stringify({ locale: "fr" }),
    });
    const res = await POST(req as any);

    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error).toContain("Supported locales");
  });

  it("returns 400 when locale is missing", async () => {
    const { POST } = await import("@/app/api/locale/route");
    const req = new Request("http://localhost/api/locale", {
      method: "POST",
      body: JSON.stringify({}),
    });
    const res = await POST(req as any);

    expect(res.status).toBe(400);
  });
});
