#!/usr/bin/env node
/**
 * Detects DATABASE_URL and patches prisma/schema.prisma provider accordingly.
 * Run before `prisma generate` or `prisma db push`.
 */
const fs = require("fs");
const path = require("path");

const schemaPath = path.join(__dirname, "..", "prisma", "schema.prisma");
const dbUrl = process.env.DATABASE_URL || "";

const provider = dbUrl.startsWith("postgresql://") || dbUrl.startsWith("postgres://")
  ? "postgresql"
  : "sqlite";

const schema = fs.readFileSync(schemaPath, "utf8");
const updated = schema.replace(
  /provider\s*=\s*"(sqlite|postgresql)"/,
  `provider = "${provider}"`
);

if (schema !== updated) {
  fs.writeFileSync(schemaPath, updated, "utf8");
  console.log(`[prisma-provider] Switched provider to "${provider}"`);
} else {
  console.log(`[prisma-provider] Provider already set to "${provider}"`);
}
