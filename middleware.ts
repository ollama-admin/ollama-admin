import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { getToken } from "next-auth/jwt";

export async function middleware(req: NextRequest) {
  const authEnabled = process.env.AUTH_ENABLED === "true";
  if (!authEnabled) return NextResponse.next();

  const publicPaths = ["/auth", "/api/auth", "/api/setup", "/_next", "/favicon.ico"];
  const isPublic = publicPaths.some((p) => req.nextUrl.pathname.startsWith(p));
  if (isPublic) return NextResponse.next();

  const token = await getToken({ req, secret: process.env.NEXTAUTH_SECRET });
  if (!token) {
    const signInUrl = new URL("/auth/signin", req.url);
    signInUrl.searchParams.set("callbackUrl", req.nextUrl.pathname);
    return NextResponse.redirect(signInUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|logo|icon|apple).*)"],
};
