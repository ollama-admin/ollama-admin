export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/require-admin";
import { randomBytes, createHash } from "crypto";

function generateKey(): { raw: string; hash: string } {
  const raw = `oa-${randomBytes(24).toString("hex")}`;
  const hash = createHash("sha256").update(raw).digest("hex");
  return { raw, hash };
}

export async function GET() {
  const session = await requireAdmin();
  if (!session) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const keys = await prisma.apiKey.findMany({
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      name: true,
      key: true,
      lastUsed: true,
      active: true,
      createdAt: true,
    },
  });

  const masked = keys.map((k) => ({
    ...k,
    key: `${k.key.slice(0, 7)}...${k.key.slice(-4)}`,
  }));

  return NextResponse.json(masked);
}

export async function POST(req: NextRequest) {
  const session = await requireAdmin();
  if (!session) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { name } = await req.json();

  if (!name?.trim()) {
    return NextResponse.json(
      { error: "name is required" },
      { status: 400 }
    );
  }

  const { raw, hash } = generateKey();

  const apiKey = await prisma.apiKey.create({
    data: {
      name: name.trim(),
      key: hash,
    },
  });

  return NextResponse.json(
    {
      id: apiKey.id,
      name: apiKey.name,
      key: raw,
      createdAt: apiKey.createdAt,
    },
    { status: 201 }
  );
}
