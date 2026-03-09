import * as cheerio from "cheerio";
import { CATALOG_RATE_LIMIT_MS } from "@/lib/constants";

export interface CatalogEntry {
  id: string;
  name: string;
  description: string;
  family: string;
  tags: string;
  pullCount: number;
  lastUpdated: string;
}

const OLLAMA_SEARCH_URL = "https://ollama.com/search";
const CATEGORIES = ["", "embedding", "vision", "tools", "thinking"];

function parsePullCount(text: string): number {
  const cleaned = text.trim().toUpperCase();
  const match = cleaned.match(/^([\d.]+)([KMB])?$/);
  if (!match) return 0;
  const num = parseFloat(match[1]);
  const suffix = match[2];
  if (suffix === "K") return Math.round(num * 1_000);
  if (suffix === "M") return Math.round(num * 1_000_000);
  if (suffix === "B") return Math.round(num * 1_000_000_000);
  return Math.round(num);
}

function inferFamily(name: string): string {
  const lower = name.toLowerCase();
  const families = [
    "llama",
    "mistral",
    "gemma",
    "phi",
    "qwen",
    "codellama",
    "deepseek",
    "vicuna",
    "starcoder",
    "command-r",
    "nomic",
    "orca",
    "falcon",
    "yi",
    "solar",
    "mixtral",
  ];
  for (const f of families) {
    if (lower.startsWith(f)) return f;
  }
  return "";
}

function parseModelsFromHtml(
  html: string,
  category: string
): CatalogEntry[] {
  const $ = cheerio.load(html);
  const models: CatalogEntry[] = [];

  $("li[x-test-model]").each((_, el) => {
    const $el = $(el);
    const name =
      $el.find("[x-test-search-response-title]").text().trim() || "";
    if (!name) return;

    const href = $el.find("a").attr("href") || "";
    const id = href.replace("/library/", "").replace("/", "") || name;

    const description = $el.find("p.break-words").text().trim();

    const capabilities: string[] = [];
    $el.find("[x-test-capability]").each((_, cap) => {
      capabilities.push($(cap).text().trim());
    });

    const sizes: string[] = [];
    $el.find("[x-test-size]").each((_, size) => {
      sizes.push($(size).text().trim());
    });

    const tags = [...capabilities, ...sizes].join(", ");
    const pullCountText =
      $el.find("[x-test-pull-count]").text().trim() || "0";
    const pullCount = parsePullCount(pullCountText);
    const lastUpdated =
      $el.find("[x-test-updated]").text().trim() || "";

    const family =
      category && category !== ""
        ? category
        : inferFamily(name);

    models.push({
      id,
      name,
      description,
      family,
      tags,
      pullCount,
      lastUpdated,
    });
  });

  return models;
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function scrapeOllamaCatalog(): Promise<CatalogEntry[]> {
  const seen = new Map<string, CatalogEntry>();

  for (const category of CATEGORIES) {
    const url = category
      ? `${OLLAMA_SEARCH_URL}?c=${category}`
      : OLLAMA_SEARCH_URL;

    const response = await fetch(url, {
      headers: {
        "User-Agent": "OllamaAdmin/1.0",
        Accept: "text/html",
      },
    });

    if (!response.ok) {
      console.warn(
        `Failed to fetch ${url}: ${response.status} ${response.statusText}`
      );
      continue;
    }

    const html = await response.text();
    const models = parseModelsFromHtml(html, category);

    for (const model of models) {
      const existing = seen.get(model.id);
      if (!existing || model.pullCount > existing.pullCount) {
        if (existing && existing.family && !model.family) {
          model.family = existing.family;
        }
        seen.set(model.id, model);
      }
    }

    if (category !== CATEGORIES[CATEGORIES.length - 1]) {
      await delay(CATALOG_RATE_LIMIT_MS);
    }
  }

  return Array.from(seen.values());
}

export { parsePullCount, parseModelsFromHtml, inferFamily };
