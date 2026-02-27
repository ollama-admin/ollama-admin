import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import catalogSnapshot from "@/data/catalog-snapshot.json";

interface CatalogEntry {
  id: string;
  name: string;
  description?: string;
  family?: string;
  tags: string;
  pullCount?: number;
  lastUpdated?: string;
}

export async function POST() {
  const count = await prisma.catalogModel.count();
  if (count > 0) {
    return NextResponse.json({ message: "Catalog already seeded", count });
  }

  const entries = catalogSnapshot as CatalogEntry[];
  if (entries.length === 0) {
    return NextResponse.json({ message: "No entries in snapshot", count: 0 });
  }

  for (const entry of entries) {
    await prisma.catalogModel.upsert({
      where: { id: entry.id },
      update: {},
      create: {
        id: entry.id,
        name: entry.name,
        description: entry.description || null,
        family: entry.family || null,
        tags: entry.tags,
        pullCount: entry.pullCount || null,
        lastUpdated: entry.lastUpdated ? new Date(entry.lastUpdated) : null,
      },
    });
  }

  return NextResponse.json({ message: "Catalog seeded", count: entries.length });
}
