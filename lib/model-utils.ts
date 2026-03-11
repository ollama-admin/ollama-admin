import type { OllamaModel } from "@/lib/ollama";

const EMBEDDING_FAMILIES = new Set(["bert", "nomic-bert"]);
const VISION_FAMILIES = new Set(["clip", "mllama"]);

interface CatalogCapabilities {
  vision?: Set<string>;
  embedding?: Set<string>;
}

let catalogCache: CatalogCapabilities | null = null;
let catalogFetchPromise: Promise<CatalogCapabilities> | null = null;

async function fetchCatalogCapabilities(): Promise<CatalogCapabilities> {
  try {
    const res = await fetch("/api/catalog");
    if (!res.ok) return {};
    const models: { id: string; capabilities: string[] }[] = await res.json();
    const vision = new Set<string>();
    const embedding = new Set<string>();
    for (const m of models) {
      if (m.capabilities.includes("vision")) vision.add(m.id);
      if (m.capabilities.includes("embedding")) embedding.add(m.id);
    }
    return { vision, embedding };
  } catch {
    return {};
  }
}

export async function loadCatalogCapabilities(): Promise<void> {
  if (catalogCache) return;
  if (!catalogFetchPromise) {
    catalogFetchPromise = fetchCatalogCapabilities().then((caps) => {
      catalogCache = caps;
      return caps;
    });
  }
  await catalogFetchPromise;
}

function getBaseName(name: string): string {
  return name.toLowerCase().split(":")[0];
}

function hasCatalogCapability(name: string, cap: "vision" | "embedding"): boolean {
  if (!catalogCache?.[cap]) return false;
  return catalogCache[cap].has(getBaseName(name));
}

export function isChatModel(model: OllamaModel): boolean {
  if (isEmbeddingModel(model)) return false;
  if (isOcrModel(model)) return false;
  return true;
}

export function isOcrModel(model: OllamaModel): boolean {
  return getBaseName(model.name).includes("ocr");
}

export function isVisionModel(model: OllamaModel): boolean {
  const families = model.details?.families;
  if (families?.some((f) => VISION_FAMILIES.has(f))) return true;
  if (hasCatalogCapability(model.name, "vision")) return true;
  return false;
}

export function isEmbeddingModel(model: OllamaModel): boolean {
  const name = model.name.toLowerCase();
  if (name.includes("embed")) return true;
  if (hasCatalogCapability(model.name, "embedding")) return true;
  const families = model.details?.families;
  if (!families || families.length === 0) return false;
  return families.every((f) => EMBEDDING_FAMILIES.has(f));
}
