import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/require-admin";
import { CATALOG_REFRESH_ENABLED } from "@/lib/constants";
import { checkRateLimit } from "@/lib/rate-limit";
import { scrapeOllamaCatalog } from "@/lib/catalog-scraper";

export async function POST() {
  const session = await requireAdmin();
  if (!session) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  if (!CATALOG_REFRESH_ENABLED) {
    return NextResponse.json(
      { error: "Catalog refresh is disabled" },
      { status: 403 }
    );
  }

  const { allowed, resetMs } = checkRateLimit("catalog-refresh");
  if (!allowed) {
    return NextResponse.json(
      { error: "Rate limited. Try again later.", retryAfterMs: resetMs },
      { status: 429 }
    );
  }

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

    return NextResponse.json({
      message: "Catalog refreshed",
      count: entries.length,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error("Catalog refresh failed:", error);
    return NextResponse.json(
      { error: "Failed to refresh catalog" },
      { status: 502 }
    );
  }
}
