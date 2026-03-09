import { prisma } from "@/lib/prisma";
import { logger } from "@/lib/logger";

type LogData = Parameters<typeof prisma.log.create>[0]["data"];

export function logAsync(data: LogData) {
  prisma.log.create({ data }).catch((err) => {
    logger.error("Failed to write log", { error: String(err) });
  });
}
