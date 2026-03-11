import { logger } from "@/lib/logger";

export interface PullJob {
  id: string;
  model: string;
  tag: string;
  serverId: string;
  status: "pulling" | "done" | "error";
  progress: number;
  error?: string;
}

const CLEANUP_DELAY_MS = 30_000;

class PullManager {
  private jobs = new Map<string, PullJob>();
  private _pending = new Map<string, Promise<void>>();

  startPull(serverId: string, serverUrl: string, modelRef: string): PullJob {
    const [model, tag] = modelRef.includes(":")
      ? modelRef.split(":", 2)
      : [modelRef, "latest"];

    const id = `${serverId}:${modelRef}`;

    const existing = this.jobs.get(id);
    if (existing && existing.status === "pulling") {
      return existing;
    }

    const job: PullJob = { id, model, tag, serverId, status: "pulling", progress: 0 };
    this.jobs.set(id, job);

    const promise = this.runPull(job, serverUrl, modelRef);
    this._pending.set(id, promise);
    promise.finally(() => this._pending.delete(id));
    return job;
  }

  getStatus(serverId?: string): PullJob[] {
    const jobs = Array.from(this.jobs.values());
    if (serverId) return jobs.filter((j) => j.serverId === serverId);
    return jobs;
  }

  private async runPull(job: PullJob, serverUrl: string, modelRef: string) {
    const url = `${serverUrl.replace(/\/$/, "")}/api/pull`;
    logger.info("Pull started", { model: modelRef, serverId: job.serverId });

    try {
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: modelRef, stream: true }),
      });

      if (!res.ok || !res.body) {
        let detail = `${res.status} ${res.statusText}`;
        try {
          const body = await res.json();
          if (body?.error) detail = body.error.replace(/[\n\t]+/g, " ").trim();
        } catch {
          // use status text as fallback
        }
        job.status = "error";
        job.error = detail;
        logger.error("Pull failed", { model: modelRef, error: detail });
        this.scheduleCleanup(job.id);
        return;
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() || "";

        for (const line of lines) {
          if (!line.trim()) continue;
          try {
            const data = JSON.parse(line);
            if (data.error) {
              job.status = "error";
              job.error = data.error.replace(/[\n\t]+/g, " ").trim();
              logger.error("Pull error from Ollama", { model: modelRef, error: data.error });
              this.scheduleCleanup(job.id);
              return;
            }
            if (data.total && data.completed) {
              job.progress = Math.round((data.completed / data.total) * 100);
            }
          } catch {
            // skip malformed lines
          }
        }
      }

      job.status = "done";
      job.progress = 100;
      logger.info("Pull completed", { model: modelRef });
    } catch (e) {
      job.status = "error";
      job.error = e instanceof Error ? e.message : "Unknown error";
      logger.error("Pull error", { model: modelRef, error: job.error });
    }

    this.scheduleCleanup(job.id);
  }

  private scheduleCleanup(id: string) {
    setTimeout(() => this.jobs.delete(id), CLEANUP_DELAY_MS);
  }
}

const globalForPull = globalThis as unknown as {
  pullManager: PullManager | undefined;
};

export const pullManager =
  globalForPull.pullManager ?? new PullManager();

if (process.env.NODE_ENV !== "production")
  globalForPull.pullManager = pullManager;
