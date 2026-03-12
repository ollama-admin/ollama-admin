export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import * as cheerio from "cheerio";

interface ScrapedModel {
  id: string;
  name: string;
  description: string;
  capabilities: string[];
  sizes: string[];
  pulls: string;
  updated: string;
}

const CACHE_TTL = 30 * 60 * 1000; // 30 minutes
const MAX_PAGES = 100;
let cache: { data: ScrapedModel[]; timestamp: number } | null = null;

const KNOWN_CAPABILITIES = ["tools", "vision", "embedding", "thinking", "cloud", "text"];

function parseModelsFromHtml(html: string): ScrapedModel[] {
  const $ = cheerio.load(html);
  const models: ScrapedModel[] = [];

  $('a[href^="/library/"]').each((_, el) => {
    const $el = $(el);
    const href = $el.attr("href") || "";
    const id = href.replace("/library/", "");
    if (!id || id.includes("/")) return;

    const heading = $el.find("h2").first().text().trim();
    const description = $el.find("p").first().text().trim();

    const capabilities: string[] = [];
    const sizes: string[] = [];
    let pulls = "";
    let updated = "";

    $el.find("span[x-test-size]").each((_, span) => {
      const text = $(span).text().trim().toLowerCase();
      if (text) sizes.push(text);
    });

    $el.find("span[x-test-capability]").each((_, span) => {
      const text = $(span).text().trim().toLowerCase();
      if (text && KNOWN_CAPABILITIES.includes(text)) capabilities.push(text);
    });

    const pullSpan = $el.find("span[x-test-pull-count]").first().text().trim();
    if (pullSpan) pulls = pullSpan;

    const updatedSpan = $el.find("span[x-test-updated]").first().text().trim();
    if (updatedSpan) updated = updatedSpan;

    models.push({ id, name: heading || id, description, capabilities, sizes, pulls, updated });
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

  const modelMap = new Map<string, ScrapedModel>();

  for (let page = 1; page <= MAX_PAGES; page++) {
    const url = page === 1
      ? "https://ollama.com/search"
      : `https://ollama.com/search?page=${page}`;
    try {
      const html = await fetchPage(url);
      const models = parseModelsFromHtml(html);
      if (models.length === 0) break;
      for (const model of models) {
        if (!modelMap.has(model.id)) {
          modelMap.set(model.id, model);
        }
      }
    } catch {
      break;
    }
  }

  const models = Array.from(modelMap.values()).filter((m) => {
    if (m.capabilities.length === 1 && m.capabilities[0] === "cloud") return false;
    return m.sizes.length > 0 || m.capabilities.length > 0;
  });

  for (const model of models) {
    model.capabilities = model.capabilities.filter((c) => c !== "cloud");
    if (!model.capabilities.includes("embedding")) {
      model.capabilities.unshift("text");
    }
  }

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
