import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { createHash } from "crypto";

export async function validateApiKey(
  req: NextRequest
): Promise<{ valid: boolean; keyId?: string }> {
  const authHeader = req.headers.get("authorization");
  if (!authHeader?.startsWith("Bearer oa-")) {
    return { valid: false };
  }

  const raw = authHeader.slice(7);
  const hash = createHash("sha256").update(raw).digest("hex");

  const key = await prisma.apiKey.findUnique({
    where: { key: hash },
  });

  if (!key || !key.active) {
    return { valid: false };
  }

  await prisma.apiKey.update({
    where: { id: key.id },
    data: { lastUsed: new Date() },
  });

  return { valid: true, keyId: key.id };
}
