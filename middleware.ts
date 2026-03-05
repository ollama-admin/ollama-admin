import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { getToken } from "next-auth/jwt";

export async function middleware(req: NextRequest) {
  const start = Date.now();
  const { method } = req;
  const path = req.nextUrl.pathname;

  // Always allow static assets, auth endpoints, setup, health check
  const publicPaths = ["/api/auth", "/api/setup", "/api/health", "/_next", "/favicon.ico"];
  if (publicPaths.some((p) => path.startsWith(p))) {
    const res = NextResponse.next();
    logRequest(method, path, res.status, Date.now() - start);
    return res;
  }

  // Allow setup and auth pages without token
  if (path.startsWith("/setup") || path.startsWith("/auth")) {
    const res = NextResponse.next();
    logRequest(method, path, res.status, Date.now() - start);
    return res;
  }

  // Check if setup is completed — redirect to /setup if not
  try {
    const statusUrl = new URL("/api/setup/status", req.url);
    const statusRes = await fetch(statusUrl);
    if (statusRes.ok) {
      const data = await statusRes.json();
      if (!data.completed) {
        logRequest(method, path, 302, Date.now() - start, "setup-redirect");
        return NextResponse.redirect(new URL("/setup", req.url));
      }
    }
  } catch {
    // If status check fails, continue normally
  }

  // Dev bypass — opt-in to disable auth for local development
  if (process.env.AUTH_DISABLED === "true") {
    const res = NextResponse.next();
    logRequest(method, path, res.status, Date.now() - start);
    return res;
  }

  // Require authentication for everything else
  const token = await getToken({ req, secret: process.env.NEXTAUTH_SECRET });
  if (!token) {
    const signInUrl = new URL("/auth/signin", req.url);
    signInUrl.searchParams.set("callbackUrl", path);
    logRequest(method, path, 302, Date.now() - start, "auth-redirect");
    return NextResponse.redirect(signInUrl);
  }

  // Admin-only routes
  if (path.startsWith("/admin/users") || path.startsWith("/api/users")) {
    if (token.role !== "admin") {
      logRequest(method, path, 403, Date.now() - start, "forbidden");
      return NextResponse.redirect(new URL("/", req.url));
    }
  }

  const res = NextResponse.next();
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
