import { prisma } from "@/lib/prisma";
import { logger } from "@/lib/logger";
import { LOG_RETENTION_DAYS } from "@/lib/constants";

type LogData = Parameters<typeof prisma.log.create>[0]["data"];

export function logAsync(data: LogData) {
  prisma.log.create({ data }).catch((err) => {
    logger.error("Failed to write log", { error: String(err) });
  });
}

async function getRetentionDays(): Promise<number> {
  try {
    const setting = await prisma.settings.findUnique({
      where: { key: "logRetentionDays" },
    });
    if (setting) {
      const days = parseInt(setting.value, 10);
      if (days > 0) return days;
    }
  } catch {
    // DB not ready yet (e.g. during setup)
  }
  return LOG_RETENTION_DAYS;
}

async function purgeExpiredLogs() {
  try {
    const days = await getRetentionDays();
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - days);

    const { count } = await prisma.log.deleteMany({
      where: { createdAt: { lt: cutoff } },
    });

    if (count > 0) {
      logger.info("Auto-purged expired logs", { count, retentionDays: days });
    }
  } catch (err) {
    logger.error("Failed to purge logs", { error: String(err) });
  }
}

// Run cleanup every hour
setInterval(purgeExpiredLogs, 60 * 60 * 1000);
