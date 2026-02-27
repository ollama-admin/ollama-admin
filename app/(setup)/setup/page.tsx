"use client";

import { useTranslations } from "next-intl";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";

type ConnectionStatus = "idle" | "testing" | "online" | "offline";

interface CuratedModel {
  name: string;
  params: string;
  vram: string;
  description: string;
}

const curatedModels: CuratedModel[] = [
  { name: "tinyllama", params: "1.1B", vram: "~1 GB", description: "Tiny and fast, great for testing" },
  { name: "llama3.2:1b", params: "1B", vram: "~1 GB", description: "Meta's smallest Llama model" },
  { name: "llama3.2:3b", params: "3B", vram: "~2 GB", description: "Good balance of speed and quality" },
  { name: "phi3:mini", params: "3.8B", vram: "~2.5 GB", description: "Microsoft's compact model" },
  { name: "gemma2:2b", params: "2B", vram: "~2 GB", description: "Google's efficient small model" },
  { name: "mistral", params: "7B", vram: "~4 GB", description: "Strong general-purpose model" },
  { name: "llama3.1:8b", params: "8B", vram: "~5 GB", description: "Meta's flagship small model" },
];

export default function SetupPage() {
  const t = useTranslations("setup");
  const router = useRouter();
  const [step, setStep] = useState(1);
  const [url, setUrl] = useState("http://localhost:11434");
  const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus>("idle");
  const [version, setVersion] = useState("");
  const [errorMsg, setErrorMsg] = useState("");
  const [selectedModel, setSelectedModel] = useState<string | null>(null);
  const [pullProgress, setPullProgress] = useState<string | null>(null);
  const [pulling, setPulling] = useState(false);
  const [serverName, setServerName] = useState("My Ollama Server");
  const [theme, setTheme] = useState("system");

  useEffect(() => {
    testConnection(url);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const testConnection = async (testUrl: string) => {
    setConnectionStatus("testing");
    setErrorMsg("");
    try {
      const res = await fetch("/api/setup/test-connection", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: testUrl }),
      });
      const data = await res.json();
      if (data.status === "online") {
        setConnectionStatus("online");
        setVersion(data.version);
      } else {
        setConnectionStatus("offline");
        setErrorMsg(data.error || "Could not connect to Ollama");
      }
    } catch {
      setConnectionStatus("offline");
      setErrorMsg("Network error — is the app running?");
    }
  };

  const handleStep1Next = async () => {
    await fetch("/api/servers", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: serverName, url }),
    });
    setStep(2);
  };

  const handlePull = async () => {
    if (!selectedModel) return;
    setPulling(true);
    setPullProgress("Starting download...");

    try {
      const serversRes = await fetch("/api/servers");
      const servers = await serversRes.json();
      const server = servers[0];
      if (!server) return;

      const res = await fetch(`${server.url}/api/pull`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: selectedModel, stream: true }),
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
              const pct = Math.round((json.completed / json.total) * 100);
              setPullProgress(`${json.status} — ${pct}%`);
            } else {
              setPullProgress(json.status || "Downloading...");
            }
          } catch {
            // skip malformed JSON lines from stream
          }
        }
      }

      setPullProgress(t("downloadComplete"));
      if ("Notification" in window && Notification.permission === "granted") {
        new Notification("Ollama Admin", { body: `${selectedModel} downloaded!` });
      }
    } catch {
      setPullProgress("Download failed. You can try again later from the admin panel.");
    } finally {
      setPulling(false);
    }
  };

  const handleFinish = async () => {
    await fetch("/api/setup/complete", { method: "POST" });
    router.push("/");
  };

  return (
    <div className="flex min-h-screen items-center justify-center p-6">
      <div className="w-full max-w-lg">
        <div className="mb-6 flex items-center gap-2">
          {[1, 2, 3].map((s) => (
            <div
              key={s}
              className={`h-2 flex-1 rounded-full transition-colors ${
                s <= step ? "bg-[hsl(var(--primary))]" : "bg-[hsl(var(--muted))]"
              }`}
            />
          ))}
        </div>

        {step === 1 && (
          <div>
            <h1 className="text-2xl font-bold">{t("step1Title")}</h1>
            <p className="mt-2 text-[hsl(var(--muted-foreground))]">
              {t("step1Description")}
            </p>

            <div className="mt-6 space-y-4">
              <div>
                <label className="mb-1 block text-sm font-medium">
                  {t("serverName")}
                </label>
                <input
                  type="text"
                  value={serverName}
                  onChange={(e) => setServerName(e.target.value)}
                  className="w-full rounded-md border bg-transparent px-3 py-2 text-sm"
                />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium">URL</label>
                <div className="flex gap-2">
                  <input
                    type="url"
                    value={url}
                    onChange={(e) => setUrl(e.target.value)}
                    className="flex-1 rounded-md border bg-transparent px-3 py-2 text-sm"
                  />
                  <button
                    onClick={() => testConnection(url)}
                    className="rounded-md border px-3 py-2 text-sm hover:bg-[hsl(var(--accent))]"
                  >
                    {t("testConnection")}
                  </button>
                </div>
              </div>

              <div className="rounded-md border p-3">
                {connectionStatus === "testing" && (
                  <p className="text-sm">{t("detecting")}</p>
                )}
                {connectionStatus === "online" && (
                  <p className="text-sm text-[hsl(var(--success))]">
                    {t("connected")} (v{version})
                  </p>
                )}
                {connectionStatus === "offline" && (
                  <div>
                    <p className="text-sm text-[hsl(var(--destructive))]">
                      {t("connectionFailed")}
                    </p>
                    <p className="mt-1 text-xs text-[hsl(var(--muted-foreground))]">
                      {errorMsg}
                    </p>
                  </div>
                )}
              </div>

              <button
                onClick={handleStep1Next}
                disabled={connectionStatus !== "online"}
                className="w-full rounded-md bg-[hsl(var(--primary))] px-4 py-2 text-sm text-[hsl(var(--primary-foreground))] disabled:opacity-50"
              >
                {t("next") || "Next"}
              </button>
            </div>
          </div>
        )}

        {step === 2 && (
          <div>
            <h1 className="text-2xl font-bold">{t("step2Title")}</h1>
            <p className="mt-2 text-[hsl(var(--muted-foreground))]">
              {t("step2Description")}
            </p>

            <div className="mt-6 space-y-2">
              {curatedModels.map((m) => (
                <button
                  key={m.name}
                  onClick={() => setSelectedModel(m.name)}
                  disabled={pulling}
                  className={`w-full rounded-md border p-3 text-left transition-colors ${
                    selectedModel === m.name
                      ? "border-[hsl(var(--primary))] bg-[hsl(var(--accent))]"
                      : "hover:bg-[hsl(var(--accent))]"
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="font-medium">{m.name}</span>
                    <span className="text-xs text-[hsl(var(--muted-foreground))]">
                      {m.params} · {m.vram}
                    </span>
                  </div>
                  <p className="mt-1 text-xs text-[hsl(var(--muted-foreground))]">
                    {m.description}
                  </p>
                </button>
              ))}
            </div>

            {pullProgress && (
              <div className="mt-4 rounded-md border p-3 text-sm">
                {pullProgress}
              </div>
            )}

            <div className="mt-4 flex gap-2">
              <button
                onClick={handlePull}
                disabled={!selectedModel || pulling}
                className="flex-1 rounded-md bg-[hsl(var(--primary))] px-4 py-2 text-sm text-[hsl(var(--primary-foreground))] disabled:opacity-50"
              >
                {pulling ? t("downloading") : "Download"}
              </button>
              <button
                onClick={() => setStep(3)}
                className="rounded-md border px-4 py-2 text-sm hover:bg-[hsl(var(--accent))]"
              >
                {t("step2Skip")}
              </button>
            </div>
          </div>
        )}

        {step === 3 && (
          <div>
            <h1 className="text-2xl font-bold">{t("step3Title")}</h1>
            <p className="mt-2 text-[hsl(var(--muted-foreground))]">
              {t("step3Description")}
            </p>

            <div className="mt-6 space-y-4">
              <div>
                <label className="mb-2 block text-sm font-medium">
                  {t("theme")}
                </label>
                <div className="flex gap-2">
                  {(["light", "dark", "system"] as const).map((m) => (
                    <button
                      key={m}
                      onClick={() => setTheme(m)}
                      className={`flex-1 rounded-md border px-3 py-2 text-sm ${
                        theme === m
                          ? "border-[hsl(var(--primary))] bg-[hsl(var(--accent))]"
                          : "hover:bg-[hsl(var(--accent))]"
                      }`}
                    >
                      {t(m === "light" ? "themeLight" : m === "dark" ? "themeDark" : "themeAuto")}
                    </button>
                  ))}
                </div>
              </div>

              <div className="flex gap-2">
                <button
                  onClick={() => setStep(2)}
                  className="rounded-md border px-4 py-2 text-sm hover:bg-[hsl(var(--accent))]"
                >
                  Back
                </button>
                <button
                  onClick={handleFinish}
                  className="flex-1 rounded-md bg-[hsl(var(--primary))] px-4 py-2 text-sm text-[hsl(var(--primary-foreground))]"
                >
                  Finish
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
