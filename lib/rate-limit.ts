interface RateLimitEntry {
  tokens: number;
  lastRefill: number;
}

interface RateLimitConfig {
  maxRequests: number;
  windowMs: number;
}

const DEFAULT_CONFIG: RateLimitConfig = {
  maxRequests: 60,
  windowMs: 60_000,
};

const store = new Map<string, RateLimitEntry>();

let configOverride: RateLimitConfig | null = null;

export function setRateLimitConfig(config: RateLimitConfig) {
  configOverride = config;
}

export function getRateLimitConfig(): RateLimitConfig {
  return configOverride || DEFAULT_CONFIG;
}

export function checkRateLimit(key: string): {
  allowed: boolean;
  remaining: number;
  resetMs: number;
} {
  const config = getRateLimitConfig();
  const now = Date.now();

  let entry = store.get(key);
  if (!entry) {
    entry = { tokens: config.maxRequests, lastRefill: now };
    store.set(key, entry);
  }

  const elapsed = now - entry.lastRefill;
  const refillRate = config.maxRequests / config.windowMs;
  const refillTokens = elapsed * refillRate;

  entry.tokens = Math.min(config.maxRequests, entry.tokens + refillTokens);
  entry.lastRefill = now;

  if (entry.tokens >= 1) {
    entry.tokens -= 1;
    return {
      allowed: true,
      remaining: Math.floor(entry.tokens),
      resetMs: Math.ceil((1 - (entry.tokens % 1)) / refillRate),
    };
  }

  const waitMs = Math.ceil((1 - entry.tokens) / refillRate);
  return {
    allowed: false,
    remaining: 0,
    resetMs: waitMs,
  };
}

export function resetRateLimit(key: string) {
  store.delete(key);
}

// Periodic cleanup of stale entries
setInterval(() => {
  const config = getRateLimitConfig();
  const now = Date.now();
  store.forEach((entry, key) => {
    if (now - entry.lastRefill > config.windowMs * 2) {
      store.delete(key);
    }
  });
}, 60_000);
