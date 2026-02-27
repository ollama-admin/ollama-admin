import { NextRequest, NextResponse } from "next/server";

const SUPPORTED_LOCALES = ["en", "es"];

export async function POST(req: NextRequest) {
  const { locale } = await req.json();

  if (!locale || !SUPPORTED_LOCALES.includes(locale)) {
    return NextResponse.json(
      { error: `Supported locales: ${SUPPORTED_LOCALES.join(", ")}` },
      { status: 400 }
    );
  }

  const res = NextResponse.json({ locale });
  res.cookies.set("locale", locale, {
    path: "/",
    maxAge: 60 * 60 * 24 * 365,
    sameSite: "lax",
  });

  return res;
}
