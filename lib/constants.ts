export const DEFAULT_OLLAMA_URL =
  process.env.DEFAULT_OLLAMA_URL || "http://localhost:11434";

export const AUTH_ENABLED = process.env.AUTH_ENABLED === "true";

export const LOG_STORE_PROMPTS = process.env.LOG_STORE_PROMPTS !== "false";

export const LOG_RETENTION_DAYS = parseInt(
  process.env.LOG_RETENTION_DAYS || "90",
  10
);

export const CATALOG_REFRESH_ENABLED =
  process.env.CATALOG_REFRESH_ENABLED !== "false";

export const CATALOG_RATE_LIMIT_MS = parseInt(
  process.env.CATALOG_RATE_LIMIT_MS || "2000",
  10
);

export const GPU_AGENT_ENABLED = process.env.GPU_AGENT_ENABLED === "true";
