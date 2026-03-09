import type { OllamaModel } from "@/lib/ollama";

const EMBEDDING_FAMILIES = new Set(["bert", "nomic-bert"]);

export function isChatModel(model: OllamaModel): boolean {
  if (model.name.toLowerCase().includes("embed")) return false;
  const families = model.details?.families;
  if (!families || families.length === 0) return true;
  return !families.every((f) => EMBEDDING_FAMILIES.has(f));
}

export function isVisionModel(model: OllamaModel): boolean {
  return model.details?.families?.includes("clip") ?? false;
}
