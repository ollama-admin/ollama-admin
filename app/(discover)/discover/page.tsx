"use client";

import { useTranslations } from "next-intl";
import { useEffect, useState } from "react";

interface CatalogModel {
  id: string;
  name: string;
  description: string | null;
  family: string | null;
  tags: string;
  pullCount: number | null;
  lastUpdated: string | null;
}

interface Server {
  id: string;
  name: string;
}

const familyOptions = [
  "llama", "mistral", "gemma", "phi", "qwen", "codellama",
  "deepseek", "vicuna", "starcoder", "command-r",
];

export default function DiscoverPage() {
  const t = useTranslations("discover");
  const [models, setModels] = useState<CatalogModel[]>([]);
  const [search, setSearch] = useState("");
  const [family, setFamily] = useState("");
  const [loading, setLoading] = useState(true);
  const [servers, setServers] = useState<Server[]>([]);
  const [selectedServer, setSelectedServer] = useState("");
  const [pullingModel, setPullingModel] = useState<string | null>(null);
  const [pullProgress, setPullProgress] = useState("");

  useEffect(() => {
    fetch("/api/servers")
      .then((r) => r.json())
      .then((data: Server[]) => {
        setServers(data);
        if (data.length > 0) setSelectedServer(data[0].id);
      });
  }, []);

  useEffect(() => {
    const params = new URLSearchParams();
    if (search) params.set("search", search);
    if (family) params.set("family", family);

    setLoading(true);
    fetch(`/api/catalog?${params}`)
      .then((r) => r.json())
      .then(setModels)
      .finally(() => setLoading(false));
  }, [search, family]);

  const handlePull = async (modelName: string) => {
    if (!selectedServer) return;
    setPullingModel(modelName);
    setPullProgress("Starting...");

    try {
      const res = await fetch("/api/admin/models/pull", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ serverId: selectedServer, name: modelName }),
      });

      if (!res.body) return;
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
            const json = JSON.parse(line);
            if (json.total && json.completed) {
              setPullProgress(`${Math.round((json.completed / json.total) * 100)}%`);
            } else {
              setPullProgress(json.status || "Downloading...");
            }
          } catch {
            // skip
          }
        }
      }
      setPullProgress("Done!");
    } catch {
      setPullProgress("Failed");
    } finally {
      setTimeout(() => {
        setPullingModel(null);
        setPullProgress("");
      }, 2000);
    }
  };

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold">{t("title")}</h1>

      <div className="mt-4 flex flex-wrap items-center gap-3">
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder={t("searchModels")}
          className="flex-1 rounded-md border bg-transparent px-3 py-2 text-sm"
        />
        <select
          value={family}
          onChange={(e) => setFamily(e.target.value)}
          className="rounded-md border bg-transparent px-3 py-2 text-sm"
        >
          <option value="">{t("allFamilies")}</option>
          {familyOptions.map((f) => (
            <option key={f} value={f}>{f}</option>
          ))}
        </select>
        {servers.length > 1 && (
          <select
            value={selectedServer}
            onChange={(e) => setSelectedServer(e.target.value)}
            className="rounded-md border bg-transparent px-3 py-2 text-sm"
          >
            {servers.map((s) => (
              <option key={s.id} value={s.id}>{s.name}</option>
            ))}
          </select>
        )}
      </div>

      {loading ? (
        <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <div key={i} className="h-32 animate-pulse rounded-lg bg-[hsl(var(--muted))]" />
          ))}
        </div>
      ) : models.length === 0 ? (
        <div className="mt-12 flex flex-col items-center text-center">
          <div className="text-5xl">🔍</div>
          <h2 className="mt-4 text-xl font-semibold">{t("emptyTitle")}</h2>
          <p className="mt-2 text-[hsl(var(--muted-foreground))]">{t("emptyDescription")}</p>
        </div>
      ) : (
        <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {models.map((model) => (
            <div key={model.id} className="rounded-lg border p-4">
              <div className="flex items-start justify-between">
                <div>
                  <h3 className="font-medium">{model.name}</h3>
                  {model.family && (
                    <span className="mt-1 inline-block rounded bg-[hsl(var(--muted))] px-1.5 py-0.5 text-xs">
                      {model.family}
                    </span>
                  )}
                </div>
                <button
                  onClick={() => handlePull(model.name)}
                  disabled={pullingModel === model.name || !selectedServer}
                  className="rounded-md bg-[hsl(var(--primary))] px-3 py-1 text-xs text-[hsl(var(--primary-foreground))] disabled:opacity-50"
                >
                  {pullingModel === model.name ? pullProgress : t("pullModel")}
                </button>
              </div>
              {model.description && (
                <p className="mt-2 line-clamp-2 text-xs text-[hsl(var(--muted-foreground))]">
                  {model.description}
                </p>
              )}
              <div className="mt-2 flex flex-wrap gap-1">
                {model.tags.split(",").map((tag) => (
                  <span
                    key={tag}
                    className="rounded bg-[hsl(var(--accent))] px-1.5 py-0.5 text-xs"
                  >
                    {tag.trim()}
                  </span>
                ))}
              </div>
              {model.pullCount && (
                <p className="mt-2 text-xs text-[hsl(var(--muted-foreground))]">
                  {model.pullCount.toLocaleString()} {t("downloads")}
                </p>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
