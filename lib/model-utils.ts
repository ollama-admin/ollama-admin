import type { OllamaModel } from "@/lib/ollama";

const EMBEDDING_FAMILIES = new Set(["bert", "nomic-bert"]);
const VISION_FAMILIES = new Set(["clip", "mllama"]);
const VISION_NAME_HINTS = ["vision", "ocr", "llava", "llava-phi", "bakllava", "moondream", "minicpm-v"];
const EMBEDDING_NAME_HINTS = ["embed", "embedding"];

export function isChatModel(model: OllamaModel): boolean {
  return !isEmbeddingModel(model);
}

export function isVisionModel(model: OllamaModel): boolean {
  const families = model.details?.families;
  if (families?.some((f) => VISION_FAMILIES.has(f))) return true;
  const name = model.name.toLowerCase().split(":")[0];
  return VISION_NAME_HINTS.some((hint) => name.includes(hint));
}

export function isEmbeddingModel(model: OllamaModel): boolean {
  const name = model.name.toLowerCase();
  if (EMBEDDING_NAME_HINTS.some((hint) => name.includes(hint))) return true;
  const families = model.details?.families;
  if (!families || families.length === 0) return false;
  return families.every((f) => EMBEDDING_FAMILIES.has(f));
}
