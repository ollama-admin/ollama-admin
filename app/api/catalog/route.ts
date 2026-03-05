export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import * as cheerio from "cheerio";

interface ScrapedModel {
  name: string;
  description: string;
  capabilities: string[];
  sizes: string[];
  pulls: string;
  updated: string;
}

const CACHE_TTL = 30 * 60 * 1000; // 30 minutes
let cache: { data: ScrapedModel[]; timestamp: number } | null = null;

const KNOWN_CAPABILITIES = ["tools", "vision", "embedding", "thinking", "code"];

function parseModelsFromHtml(html: string): ScrapedModel[] {
  const $ = cheerio.load(html);
  const models: ScrapedModel[] = [];

  $('a[href^="/library/"]').each((_, el) => {
    const $el = $(el);
    const href = $el.attr("href") || "";
    const name = href.replace("/library/", "");
    if (!name || name.includes("/")) return;

    const description = $el.find("p").first().text().trim();

    const capabilities: string[] = [];
    const sizes: string[] = [];
    let pulls = "";
    let updated = "";

    $el.find("span").each((_, span) => {
      const text = $(span).text().trim();
      if (text.match(/Pulls$/i)) {
        pulls = text.replace(/\s*Pulls$/i, "");
      } else if (text.match(/^Updated/i)) {
        updated = text;
      } else if (text.match(/^\d+(\.\d+)?[bBmM]$/)) {
        sizes.push(text.toLowerCase());
      } else if (KNOWN_CAPABILITIES.includes(text.toLowerCase())) {
        capabilities.push(text.toLowerCase());
      }
    });

    models.push({ name, description, capabilities, sizes, pulls, updated });
  });

  return models;
}

async function fetchPage(url: string): Promise<string> {
  const res = await fetch(url, {
    headers: {
      "User-Agent":
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
    },
  });
  if (!res.ok) throw new Error(`Failed to fetch ${url}: ${res.status}`);
  return res.text();
}

async function scrapeAllModels(): Promise<ScrapedModel[]> {
  if (cache && Date.now() - cache.timestamp < CACHE_TTL) {
    return cache.data;
  }

  const letters = "abcdefghijklmnopqrstuvwxyz0123456789".split("");
  const batchSize = 6;
  const modelMap = new Map<string, ScrapedModel>();

  // Also scrape the default page and each category
  const extraUrls = [
    "https://ollama.com/search",
    ...KNOWN_CAPABILITIES.map(
      (c) => `https://ollama.com/search?c=${c}`
    ),
  ];

  for (const url of extraUrls) {
    try {
      const html = await fetchPage(url);
      for (const model of parseModelsFromHtml(html)) {
        if (!modelMap.has(model.name)) {
          modelMap.set(model.name, model);
        }
      }
    } catch {
      // continue on error
    }
  }

  // Scrape by letter in batches to avoid overwhelming the server
  for (let i = 0; i < letters.length; i += batchSize) {
    const batch = letters.slice(i, i + batchSize);
    const results = await Promise.all(
      batch.map((letter) =>
        fetchPage(`https://ollama.com/search?q=${letter}`).catch(() => "")
      )
    );
    for (const html of results) {
      if (!html) continue;
      for (const model of parseModelsFromHtml(html)) {
        if (!modelMap.has(model.name)) {
          modelMap.set(model.name, model);
        }
      }
    }
  }

  // Filter out cloud-only models (no sizes, only cloud capability)
  const models = Array.from(modelMap.values()).filter((m) => {
    const isCloudOnly =
      m.capabilities.length === 0 ||
      (m.capabilities.length === 1 && m.capabilities[0] === "cloud");
    // Keep if it has sizes or non-cloud capabilities
    return m.sizes.length > 0 || !isCloudOnly;
  });

  // Remove 'cloud' from capabilities
  for (const model of models) {
    model.capabilities = model.capabilities.filter((c) => c !== "cloud");
  }

  // Sort by pulls (approximate numeric sort)
  models.sort((a, b) => {
    const parseCount = (s: string) => {
      if (!s) return 0;
      const num = parseFloat(s);
      if (s.includes("M")) return num * 1_000_000;
      if (s.includes("K")) return num * 1_000;
      return num;
    };
    return parseCount(b.pulls) - parseCount(a.pulls);
  });

  cache = { data: models, timestamp: Date.now() };
  return models;
}

export async function GET(req: NextRequest) {
  const search = req.nextUrl.searchParams.get("q")?.toLowerCase() || "";
  const capabilities = req.nextUrl.searchParams.get("c")?.toLowerCase() || "";
  const capList = capabilities
    ? capabilities.split(",").filter(Boolean)
    : [];

  try {
    let models = await scrapeAllModels();

    if (search) {
      models = models.filter(
        (m) =>
          m.name.toLowerCase().includes(search) ||
          m.description.toLowerCase().includes(search)
      );
    }

    if (capList.length > 0) {
      models = models.filter((m) =>
        capList.every((c) => m.capabilities.includes(c))
      );
    }

    return NextResponse.json(models);
  } catch {
    return NextResponse.json(
      { error: "Failed to fetch models from ollama.com" },
      { status: 502 }
    );
  }
}
