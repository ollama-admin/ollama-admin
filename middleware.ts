import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { getToken } from "next-auth/jwt";

let setupCompleted = false;
let setupCheckedAt = 0;

function withNoCache(res: NextResponse, path: string): NextResponse {
  if (path.startsWith("/api/")) {
    res.headers.set("Cache-Control", "no-store");
  }
  return res;
}

export async function middleware(req: NextRequest) {
  const start = Date.now();
  const { method } = req;
  const path = req.nextUrl.pathname;

  // Always allow static assets, auth endpoints, setup, health check
  const publicPaths = ["/api/auth", "/api/setup", "/api/health", "/_next", "/favicon.ico"];
  if (publicPaths.some((p) => path.startsWith(p))) {
    const res = withNoCache(NextResponse.next(), path);
    logRequest(method, path, res.status, Date.now() - start);
    return res;
  }

  // Allow setup and auth pages without token
  if (path.startsWith("/setup") || path.startsWith("/auth")) {
    const res = NextResponse.next();
    logRequest(method, path, res.status, Date.now() - start);
    return res;
  }

  // Check if setup is completed — redirect to /setup if not (cached 60s)
  if (!setupCompleted || Date.now() - setupCheckedAt > 60_000) {
    try {
      const statusUrl = new URL("/api/setup/status", req.url);
      const statusRes = await fetch(statusUrl, { cache: "no-store" });
      if (statusRes.ok) {
        const data = await statusRes.json();
        setupCompleted = !!data.completed;
        setupCheckedAt = Date.now();
      }
    } catch {
      // If status check fails, continue normally
    }
  }

  if (!setupCompleted) {
    logRequest(method, path, 302, Date.now() - start, "setup-redirect");
    return NextResponse.redirect(new URL("/setup", req.url));
  }

  // Dev bypass — opt-in to disable auth for local development
  if (process.env.AUTH_DISABLED === "true") {
    const res = withNoCache(NextResponse.next(), path);
    logRequest(method, path, res.status, Date.now() - start);
    return res;
  }

  // Allow API key authentication for API routes
  const authHeader = req.headers.get("authorization");
  const hasApiKey = !!authHeader && authHeader.startsWith("Bearer oa-");

  if (hasApiKey && path.startsWith("/api/")) {
    const res = withNoCache(NextResponse.next(), path);
    logRequest(method, path, res.status, Date.now() - start, "api-key");
    return res;
  }

  // Require authentication for everything else
  const token = await getToken({ req, secret: process.env.NEXTAUTH_SECRET });
  if (!token) {
    if (path.startsWith("/api/")) {
      logRequest(method, path, 401, Date.now() - start, "unauthorized");
      return new NextResponse(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { "Content-Type": "application/json" },
      });
    }
    const signInUrl = new URL("/auth/signin", req.url);
    signInUrl.searchParams.set("callbackUrl", path);
    logRequest(method, path, 302, Date.now() - start, "auth-redirect");
    return NextResponse.redirect(signInUrl);
  }

  // Admin-only routes
  const isAdminOnly =
    path.startsWith("/admin/") ||
    path.startsWith("/api/admin/") ||
    path.startsWith("/api/users") ||
    path.startsWith("/api/api-keys") ||
    path.startsWith("/settings");
  if (isAdminOnly && token?.role !== "admin") {
    logRequest(method, path, 403, Date.now() - start, "forbidden");
    return NextResponse.redirect(new URL("/", req.url));
  }

  const res = withNoCache(NextResponse.next(), path);
  logRequest(method, path, res.status, Date.now() - start);
  return res;
}

function logRequest(method: string, path: string, status: number, ms: number, note?: string) {
  if (path.startsWith("/_next")) return;
  const extra = note ? ` (${note})` : "";
  console.log(`${new Date().toISOString()} [HTTP] ${method} ${path} ${status} ${ms}ms${extra}`);
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|logo|icon|apple).*)"],
};
