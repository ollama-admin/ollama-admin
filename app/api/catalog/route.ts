export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { CATALOG_REFRESH_ENABLED } from "@/lib/constants";
import { scrapeOllamaCatalog } from "@/lib/catalog-scraper";

export async function GET(req: NextRequest) {
  const search = req.nextUrl.searchParams.get("search") || "";
  const family = req.nextUrl.searchParams.get("family") || "";

  // Auto-seed on first access
  const total = await prisma.catalogModel.count();
  if (total === 0 && CATALOG_REFRESH_ENABLED) {
    try {
      const entries = await scrapeOllamaCatalog();
      for (const entry of entries) {
        await prisma.catalogModel.upsert({
          where: { id: entry.id },
          update: {
            name: entry.name,
            description: entry.description || null,
            family: entry.family || null,
            tags: entry.tags,
            pullCount: entry.pullCount || null,
            lastUpdated: entry.lastUpdated ? new Date() : null,
            cachedAt: new Date(),
          },
          create: {
            id: entry.id,
            name: entry.name,
            description: entry.description || null,
            family: entry.family || null,
            tags: entry.tags,
            pullCount: entry.pullCount || null,
            lastUpdated: entry.lastUpdated ? new Date() : null,
          },
        });
      }
    } catch (e) {
      console.warn("Auto-seed failed:", e);
    }
  }

  const where: Record<string, unknown> = {};
  if (search) {
    where.name = { contains: search };
  }
  if (family) {
    where.family = family;
  }

  const models = await prisma.catalogModel.findMany({
    where,
    orderBy: { pullCount: "desc" },
  });

  const families = await prisma.catalogModel.findMany({
    where: { family: { not: "" } },
    select: { family: true },
    distinct: ["family"],
    orderBy: { family: "asc" },
  });

  const lastEntry = await prisma.catalogModel.findFirst({
    orderBy: { cachedAt: "desc" },
    select: { cachedAt: true },
  });

  return NextResponse.json({
    models,
    families: families.map((f) => f.family).filter(Boolean),
    lastRefreshed: lastEntry?.cachedAt?.toISOString() || null,
    total: models.length,
  });
}
