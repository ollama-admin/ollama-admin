"use client";

import { useState, useEffect, useCallback } from "react";
import { useTranslations } from "next-intl";
import { RotateCcw, Save, BookOpen, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Modal } from "@/components/ui/modal";
import { useToast } from "@/components/ui/toast";

export interface ChatParameters {
  temperature?: number;
  topK?: number;
  topP?: number;
  systemPrompt?: string;
}

interface Preset {
  id: string;
  name: string;
  temperature: number | null;
  topK: number | null;
  topP: number | null;
  numCtx: number | null;
  numPredict: number | null;
  systemPrompt: string | null;
}

const DEFAULTS: ChatParameters = {
  temperature: 0.7,
  topK: 40,
  topP: 0.9,
};

interface ChatParametersModalProps {
  open: boolean;
  onClose: () => void;
  parameters: ChatParameters;
  onChange: (params: ChatParameters) => void;
}

export function ChatParametersModal({
  open,
  onClose,
  parameters,
  onChange,
}: ChatParametersModalProps) {
  const t = useTranslations("chat.parameters");
  const tPresets = useTranslations("chat.presets");
  const { toast } = useToast();
  const [presets, setPresets] = useState<Preset[]>([]);
  const [showSavePreset, setShowSavePreset] = useState(false);
  const [presetName, setPresetName] = useState("");

  const fetchPresets = useCallback(async () => {
    const res = await fetch("/api/presets");
    setPresets(await res.json());
  }, []);

  useEffect(() => {
    if (open) fetchPresets();
  }, [open, fetchPresets]);

  const update = (key: keyof ChatParameters, value: unknown) => {
    onChange({ ...parameters, [key]: value || undefined });
  };

  const reset = () => onChange({});

  const loadPreset = (preset: Preset) => {
    const params: ChatParameters = {};
    if (preset.temperature !== null) params.temperature = preset.temperature;
    if (preset.topK !== null) params.topK = preset.topK;
    if (preset.topP !== null) params.topP = preset.topP;
    if (preset.systemPrompt) params.systemPrompt = preset.systemPrompt;
    onChange(params);
    toast(tPresets("loaded", { name: preset.name }), "success");
  };

  const savePreset = async () => {
    if (!presetName.trim()) return;
    try {
      await fetch("/api/presets", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: presetName.trim(),
          temperature: parameters.temperature ?? null,
          topK: parameters.topK ?? null,
          topP: parameters.topP ?? null,
          numCtx: null,
          numPredict: null,
          systemPrompt: parameters.systemPrompt ?? null,
        }),
      });
      setPresetName("");
      setShowSavePreset(false);
      fetchPresets();
      toast(tPresets("saved"), "success");
    } catch {
      toast(tPresets("saveError"), "error");
    }
  };

  const deletePreset = async (id: string) => {
    try {
      await fetch(`/api/presets/${id}`, { method: "DELETE" });
      fetchPresets();
      toast(tPresets("deleted"), "success");
    } catch {
      toast(tPresets("deleteError"), "error");
    }
  };

  const tempValue = parameters.temperature ?? DEFAULTS.temperature!;
  const topPValue = parameters.topP ?? DEFAULTS.topP!;

  return (
    <Modal open={open} onClose={onClose} title={t("title")} className="max-w-2xl">
      {/* Presets */}
      {(presets.length > 0 || showSavePreset) && (
        <div className="mb-6 flex flex-wrap items-center gap-2">
          <BookOpen className="h-4 w-4 text-[hsl(var(--muted-foreground))]" />
          {presets.map((preset) => (
            <span key={preset.id} className="flex items-center gap-1">
              <button
                onClick={() => loadPreset(preset)}
                className="rounded-full border px-2.5 py-0.5 text-xs transition-colors hover:bg-[hsl(var(--accent))]"
              >
                {preset.name}
              </button>
              <button
                onClick={() => deletePreset(preset.id)}
                className="rounded p-0.5 text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--destructive))]"
                aria-label={tPresets("deletePreset", { name: preset.name })}
              >
                <Trash2 className="h-3 w-3" />
              </button>
            </span>
          ))}
          {showSavePreset && (
            <span className="flex items-center gap-1">
              <input
                type="text"
                value={presetName}
                onChange={(e) => setPresetName(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && savePreset()}
                placeholder={tPresets("namePlaceholder")}
                className="h-7 w-32 rounded-md border bg-transparent px-2 text-xs focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[hsl(var(--ring))]"
                autoFocus
              />
              <Button variant="ghost" size="sm" onClick={savePreset} className="h-7 px-2">
                <Save className="h-3.5 w-3.5" />
              </Button>
              <Button variant="ghost" size="sm" onClick={() => setShowSavePreset(false)} className="h-7 px-2">
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            </span>
          )}
        </div>
      )}

      <div className="grid gap-6 sm:grid-cols-2">
        {/* Left: Parameters */}
        <div className="space-y-5">
          {/* Temperature */}
          <div>
            <div className="mb-2 flex items-center justify-between">
              <label className="text-sm font-medium">{t("temperature")}</label>
              <span className="rounded-md bg-[hsl(var(--muted))] px-2 py-0.5 text-xs font-mono tabular-nums">
                {tempValue.toFixed(1)}
              </span>
            </div>
            <input
              type="range"
              min="0"
              max="2"
              step="0.1"
              value={tempValue}
              onChange={(e) => update("temperature", parseFloat(e.target.value))}
              className="w-full accent-[hsl(var(--primary))]"
            />
            <div className="mt-1 flex justify-between text-[10px] text-[hsl(var(--muted-foreground))]">
              <span>{t("precise")}</span>
              <span>{t("creative")}</span>
            </div>
          </div>

          {/* Top P */}
          <div>
            <div className="mb-2 flex items-center justify-between">
              <label className="text-sm font-medium">{t("topP")}</label>
              <span className="rounded-md bg-[hsl(var(--muted))] px-2 py-0.5 text-xs font-mono tabular-nums">
                {topPValue.toFixed(2)}
              </span>
            </div>
            <input
              type="range"
              min="0"
              max="1"
              step="0.05"
              value={topPValue}
              onChange={(e) => update("topP", parseFloat(e.target.value))}
              className="w-full accent-[hsl(var(--primary))]"
            />
            <div className="mt-1 flex justify-between text-[10px] text-[hsl(var(--muted-foreground))]">
              <span>{t("focused")}</span>
              <span>{t("diverse")}</span>
            </div>
          </div>

          {/* Top K */}
          <Input
            label={t("topK")}
            type="number"
            min={0}
            max={100}
            value={parameters.topK ?? ""}
            onChange={(e) =>
              update("topK", e.target.value ? parseInt(e.target.value) : undefined)
            }
            className="text-sm"
          />
        </div>

        {/* Right: System prompt */}
        <div className="flex flex-col">
          <Textarea
            label={t("systemPrompt")}
            value={parameters.systemPrompt ?? ""}
            onChange={(e) => update("systemPrompt", e.target.value || undefined)}
            placeholder={t("systemPromptPlaceholder")}
            rows={9}
            className="flex-1 text-sm"
          />
        </div>
      </div>

      {/* Footer */}
      <div className="mt-6 flex items-center justify-between border-t pt-4">
        <div className="flex gap-2">
          <Button variant="ghost" size="sm" onClick={reset}>
            <RotateCcw className="mr-1.5 h-3.5 w-3.5" />
            {t("reset")}
          </Button>
          {!showSavePreset && (
            <Button variant="ghost" size="sm" onClick={() => setShowSavePreset(true)}>
              <Save className="mr-1.5 h-3.5 w-3.5" />
              {tPresets("save")}
            </Button>
          )}
        </div>
        <Button size="sm" onClick={onClose}>
          {t("done")}
        </Button>
      </div>
    </Modal>
  );
}
