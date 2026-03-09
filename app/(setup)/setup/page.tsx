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
  { name: "gemma3:1b", params: "1B", vram: "~1 GB", description: "Google's ultra-light model, great for testing" },
  { name: "ministral-3:3b", params: "3B", vram: "~3 GB", description: "Mistral's edge model, 256K context" },
  { name: "gemma3:4b", params: "4B", vram: "~3 GB", description: "Google's multimodal model with vision" },
  { name: "qwen3.5:4b", params: "4B", vram: "~3 GB", description: "Alibaba's efficient model, 256K context" },
  { name: "ministral-3:8b", params: "8B", vram: "~6 GB", description: "Mistral's balanced edge model" },
  { name: "qwen3.5:9b", params: "9B", vram: "~7 GB", description: "Alibaba's strong all-rounder with vision" },
  { name: "gemma3:12b", params: "12B", vram: "~8 GB", description: "Google's 128K multimodal, great quality" },
  { name: "lfm2:24b", params: "24B MoE", vram: "~14 GB", description: "Liquid AI — only 2B active params, very fast" },
  { name: "gpt-oss:20b", params: "20B", vram: "~14 GB", description: "OpenAI's open model, 128K context" },
  { name: "ministral-3:14b", params: "14B", vram: "~9 GB", description: "Mistral's largest edge model, 256K context" },
];

export default function SetupPage() {
  const t = useTranslations("setup");
  const router = useRouter();
  const [step, setStep] = useState(1);
  const [url, setUrl] = useState("http://localhost:11434");
  const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus>("idle");
  const [version, setVersion] = useState("");
  const [errorMsg, setErrorMsg] = useState("");
  const [selectedModels, setSelectedModels] = useState<string[]>([]);
  const [pullProgress, setPullProgress] = useState<string | null>(null);
  const [pulling, setPulling] = useState(false);
  const [downloaded, setDownloaded] = useState(false);
  const [serverName, setServerName] = useState("My Ollama Server");
  const [serverId, setServerId] = useState<string | null>(null);
  const [theme, setTheme] = useState("system");
  const [logRetention, setLogRetention] = useState("90");

  // Admin account state
  const [adminUsername, setAdminUsername] = useState("");
  const [adminPassword, setAdminPassword] = useState("");
  const [adminConfirm, setAdminConfirm] = useState("");
  const [adminError, setAdminError] = useState("");
  const [adminLoading, setAdminLoading] = useState(false);

  useEffect(() => {
    fetch("/api/setup/status")
      .then((r) => r.json())
      .then((data) => {
        if (data.completed) {
          router.push("/");
          return;
        }
        if (data.hasAdmin) {
          setStep(2);
        }
      })
      .catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleCreateAdmin = async () => {
    setAdminError("");

    if (adminUsername.length < 3) {
      setAdminError(t("usernameTooShort"));
      return;
    }
    if (adminPassword.length < 8) {
      setAdminError(t("passwordTooShort"));
      return;
    }
    if (adminPassword !== adminConfirm) {
      setAdminError(t("passwordMismatch"));
      return;
    }

    setAdminLoading(true);
    try {
      const res = await fetch("/api/setup/admin", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          username: adminUsername,
          password: adminPassword,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        setAdminError(data.error || "Failed to create admin");
        return;
      }

      setStep(2);
    } catch {
      setAdminError("Network error");
    } finally {
      setAdminLoading(false);
    }
  };

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

  const handleStep2Next = async () => {
    const res = await fetch("/api/setup/server", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: serverName, url }),
    });
    if (res.ok) {
      const server = await res.json();
      setServerId(server.id);
    }
    setStep(3);
  };

  const toggleModel = (name: string) => {
    setSelectedModels((prev) =>
      prev.includes(name) ? prev.filter((m) => m !== name) : [...prev, name]
    );
  };

  const pullModel = async (serverId: string, modelName: string): Promise<boolean> => {
    setPullProgress(`${modelName}: Starting download...`);
    try {
      const res = await fetch("/api/setup/pull", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ serverId, name: modelName }),
      });

      if (!res.ok || !res.body) {
        setPullProgress(`${modelName}: Download failed`);
        return false;
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
            const json = JSON.parse(line);
            if (json.total && json.completed) {
              const pct = Math.round((json.completed / json.total) * 100);
              setPullProgress(`${modelName}: ${json.status} — ${pct}%`);
            } else {
              setPullProgress(`${modelName}: ${json.status || "Downloading..."}`);
            }
          } catch {
            // skip malformed JSON lines from stream
          }
        }
      }
      return true;
    } catch {
      setPullProgress(`${modelName}: Download failed`);
      return false;
    }
  };

  const handlePull = async () => {
    if (selectedModels.length === 0) return;
    setPulling(true);

    let currentServerId = serverId;
    if (!currentServerId) {
      const res = await fetch("/api/setup/server");
      if (res.ok) {
        const server = await res.json();
        currentServerId = server.id;
        setServerId(server.id);
      }
    }
    if (!currentServerId) {
      setPullProgress("Error: no server configured. Go back and connect to Ollama.");
      setPulling(false);
      return;
    }

    for (const modelName of selectedModels) {
      await pullModel(currentServerId, modelName);
    }

    setPullProgress(t("downloadComplete"));
    setDownloaded(true);
    if ("Notification" in window && Notification.permission === "granted") {
      new Notification("Ollama Admin", { body: `${selectedModels.length} model(s) downloaded!` });
    }
    setPulling(false);
  };

  const handleFinish = async () => {
    await fetch("/api/settings", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ logRetentionDays: logRetention }),
    });
    await fetch("/api/setup/complete", { method: "POST" });
    router.push("/auth/signin");
  };

  return (
    <div className="flex min-h-screen items-center justify-center p-6">
      <div className="w-full max-w-lg">
        <div className="mb-6 flex items-center gap-2">
          {[1, 2, 3, 4].map((s) => (
            <div
              key={s}
              className={`h-2 flex-1 rounded-full transition-colors ${
                s <= step ? "bg-[hsl(var(--primary))]" : "bg-[hsl(var(--muted))]"
              }`}
            />
          ))}
        </div>

        {/* Step 1: Create Admin Account */}
        {step === 1 && (
          <div>
            <h1 className="text-2xl font-bold">{t("adminTitle")}</h1>
            <p className="mt-2 text-[hsl(var(--muted-foreground))]">
              {t("adminDescription")}
            </p>

            <div className="mt-6 space-y-4">
              <div>
                <label className="mb-1 block text-sm font-medium">
                  {t("adminUsername")}
                </label>
                <input
                  type="text"
                  value={adminUsername}
                  onChange={(e) => setAdminUsername(e.target.value)}
                  autoComplete="username"
                  className="w-full rounded-md border bg-transparent px-3 py-2 text-sm"
                  placeholder="admin"
                />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium">
                  {t("adminPassword")}
                </label>
                <input
                  type="password"
                  value={adminPassword}
                  onChange={(e) => setAdminPassword(e.target.value)}
                  autoComplete="new-password"
                  className="w-full rounded-md border bg-transparent px-3 py-2 text-sm"
                />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium">
                  {t("adminConfirmPassword")}
                </label>
                <input
                  type="password"
                  value={adminConfirm}
                  onChange={(e) => setAdminConfirm(e.target.value)}
                  autoComplete="new-password"
                  className="w-full rounded-md border bg-transparent px-3 py-2 text-sm"
                />
              </div>

              {adminError && (
                <p className="text-sm text-[hsl(var(--destructive))]">
                  {adminError}
                </p>
              )}

              <button
                onClick={handleCreateAdmin}
                disabled={adminLoading}
                className="w-full rounded-md bg-[hsl(var(--primary))] px-4 py-2 text-sm text-[hsl(var(--primary-foreground))] disabled:opacity-50"
              >
                {adminLoading ? t("creating") : t("createAdmin")}
              </button>
            </div>
          </div>
        )}

        {/* Step 2: Connect to Ollama */}
        {step === 2 && (
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
                {connectionStatus === "idle" && (
                  <p className="text-sm text-[hsl(var(--muted-foreground))]">
                    {t("testConnection")}
                  </p>
                )}
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
                onClick={handleStep2Next}
                disabled={connectionStatus !== "online"}
                className="w-full rounded-md bg-[hsl(var(--primary))] px-4 py-2 text-sm text-[hsl(var(--primary-foreground))] disabled:opacity-50"
              >
                {t("next") || "Next"}
              </button>
            </div>
          </div>
        )}

        {/* Step 3: Download a Model */}
        {step === 3 && (
          <div className="flex max-h-[80vh] flex-col">
            <h1 className="text-2xl font-bold">{t("step2Title")}</h1>
            <p className="mt-2 text-[hsl(var(--muted-foreground))]">
              {t("step2Description")}
            </p>

            <div className="mt-6 min-h-0 flex-1 space-y-2 overflow-y-auto pr-1">
              {curatedModels.map((m) => (
                <button
                  key={m.name}
                  onClick={() => toggleModel(m.name)}
                  disabled={pulling}
                  className={`w-full rounded-md border p-3 text-left transition-colors ${
                    selectedModels.includes(m.name)
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

            <div className="shrink-0 pt-4">
              {(pulling || pullProgress) && (
                <div className="mb-3 rounded-md border border-[hsl(var(--primary))] bg-[hsl(var(--accent))] p-3 text-sm font-medium">
                  {pullProgress || "Preparing download..."}
                </div>
              )}

              <div className="flex gap-2">
                {downloaded ? (
                  <button
                    onClick={() => setStep(4)}
                    className="flex-1 rounded-md bg-[hsl(var(--primary))] px-4 py-2 text-sm text-[hsl(var(--primary-foreground))]"
                  >
                    {t("next") || "Next"}
                  </button>
                ) : (
                  <>
                    <button
                      onClick={handlePull}
                      disabled={selectedModels.length === 0 || pulling}
                      className="flex-1 rounded-md bg-[hsl(var(--primary))] px-4 py-2 text-sm text-[hsl(var(--primary-foreground))] disabled:opacity-50"
                    >
                      {pulling ? t("downloading") : `Download${selectedModels.length > 1 ? ` (${selectedModels.length})` : ""}`}
                    </button>
                    <button
                      onClick={() => setStep(4)}
                      className="rounded-md border px-4 py-2 text-sm hover:bg-[hsl(var(--accent))]"
                    >
                      {t("step2Skip")}
                    </button>
                  </>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Step 4: Theme */}
        {step === 4 && (
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

              <div>
                <label className="mb-1 block text-sm font-medium">
                  {t("logRetentionDays")}
                </label>
                <input
                  type="number"
                  min="1"
                  max="365"
                  value={logRetention}
                  onChange={(e) => setLogRetention(e.target.value)}
                  className="w-full rounded-md border bg-transparent px-3 py-2 text-sm"
                />
                <p className="mt-1 text-xs text-[hsl(var(--muted-foreground))]">
                  {t("logRetentionDescription")}
                </p>
              </div>

              <div className="flex gap-2">
                <button
                  onClick={() => setStep(3)}
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
