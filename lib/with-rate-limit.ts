import { NextRequest, NextResponse } from "next/server";
import { checkRateLimit } from "@/lib/rate-limit";

export function getRateLimitKey(req: NextRequest): string {
  const forwarded = req.headers.get("x-forwarded-for");
  const ip = forwarded?.split(",")[0]?.trim() || "unknown";
  return `ip:${ip}`;
}

export function withRateLimit(
  handler: (req: NextRequest, ctx: any) => Promise<Response>
) {
  return async (req: NextRequest, ctx: any) => {
    const key = getRateLimitKey(req);
    const result = checkRateLimit(key);

    if (!result.allowed) {
      return NextResponse.json(
        { error: "Too many requests. Please try again later." },
        {
          status: 429,
          headers: {
            "Retry-After": String(Math.ceil(result.resetMs / 1000)),
            "X-RateLimit-Remaining": "0",
            "X-RateLimit-Reset": String(result.resetMs),
          },
        }
      );
    }

    const response = await handler(req, ctx);

    const headers = new Headers(response.headers);
    headers.set("X-RateLimit-Remaining", String(result.remaining));

    return new Response(response.body, {
      status: response.status,
      statusText: response.statusText,
      headers,
    });
  };
}
