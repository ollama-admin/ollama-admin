"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Settings2, ChevronDown, ChevronUp, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

export interface ChatParameters {
  temperature?: number;
  topK?: number;
  topP?: number;
  repeatPenalty?: number;
  seed?: number;
  numCtx?: number;
  numPredict?: number;
  stop?: string;
  systemPrompt?: string;
  keepAlive?: string;
}

const DEFAULTS: ChatParameters = {
  temperature: 0.7,
  topK: 40,
  topP: 0.9,
  repeatPenalty: 1.1,
  numCtx: 2048,
};

interface ChatParametersPanelProps {
  parameters: ChatParameters;
  onChange: (params: ChatParameters) => void;
}

export function ChatParametersPanel({
  parameters,
  onChange,
}: ChatParametersPanelProps) {
  const t = useTranslations("chat.parameters");
  const [expanded, setExpanded] = useState(false);

  const update = (key: keyof ChatParameters, value: unknown) => {
    onChange({ ...parameters, [key]: value || undefined });
  };

  const reset = () => {
    onChange({});
  };

  return (
    <div className="border-b">
      <button
        onClick={() => setExpanded(!expanded)}
        className="flex w-full items-center gap-2 px-4 py-2 text-sm text-[hsl(var(--muted-foreground))] transition-colors hover:text-[hsl(var(--foreground))]"
        aria-expanded={expanded}
        aria-controls="chat-parameters-panel"
      >
        <Settings2 className="h-4 w-4" />
        <span>{t("title")}</span>
        {expanded ? (
          <ChevronUp className="ml-auto h-4 w-4" />
        ) : (
          <ChevronDown className="ml-auto h-4 w-4" />
        )}
      </button>

      {expanded && (
        <div
          id="chat-parameters-panel"
          className="grid grid-cols-2 gap-3 px-4 pb-3 md:grid-cols-4"
        >
          <div>
            <label className="mb-1 block text-xs font-medium">
              {t("temperature")}
            </label>
            <input
              type="range"
              min="0"
              max="2"
              step="0.1"
              value={parameters.temperature ?? DEFAULTS.temperature}
              onChange={(e) => update("temperature", parseFloat(e.target.value))}
              className="w-full accent-[hsl(var(--primary))]"
            />
            <span className="text-xs text-[hsl(var(--muted-foreground))]">
              {parameters.temperature ?? DEFAULTS.temperature}
            </span>
          </div>

          <div>
            <label className="mb-1 block text-xs font-medium">
              {t("topP")}
            </label>
            <input
              type="range"
              min="0"
              max="1"
              step="0.05"
              value={parameters.topP ?? DEFAULTS.topP}
              onChange={(e) => update("topP", parseFloat(e.target.value))}
              className="w-full accent-[hsl(var(--primary))]"
            />
            <span className="text-xs text-[hsl(var(--muted-foreground))]">
              {parameters.topP ?? DEFAULTS.topP}
            </span>
          </div>

          <Input
            label={t("topK")}
            type="number"
            min={0}
            max={100}
            value={parameters.topK ?? ""}
            onChange={(e) =>
              update("topK", e.target.value ? parseInt(e.target.value) : undefined)
            }
            className="h-8 text-xs"
          />

          <div>
            <label className="mb-1 block text-xs font-medium">
              {t("repeatPenalty")}
            </label>
            <input
              type="range"
              min="0"
              max="2"
              step="0.1"
              value={parameters.repeatPenalty ?? DEFAULTS.repeatPenalty}
              onChange={(e) =>
                update("repeatPenalty", parseFloat(e.target.value))
              }
              className="w-full accent-[hsl(var(--primary))]"
            />
            <span className="text-xs text-[hsl(var(--muted-foreground))]">
              {parameters.repeatPenalty ?? DEFAULTS.repeatPenalty}
            </span>
          </div>

          <Input
            label={t("seed")}
            type="number"
            value={parameters.seed ?? ""}
            onChange={(e) =>
              update("seed", e.target.value ? parseInt(e.target.value) : undefined)
            }
            className="h-8 text-xs"
          />

          <Input
            label={t("numCtx")}
            type="number"
            min={256}
            value={parameters.numCtx ?? ""}
            onChange={(e) =>
              update("numCtx", e.target.value ? parseInt(e.target.value) : undefined)
            }
            className="h-8 text-xs"
          />

          <Input
            label={t("numPredict")}
            type="number"
            min={-1}
            value={parameters.numPredict ?? ""}
            onChange={(e) =>
              update(
                "numPredict",
                e.target.value ? parseInt(e.target.value) : undefined
              )
            }
            className="h-8 text-xs"
          />

          <Input
            label={t("keepAlive")}
            type="text"
            placeholder="5m"
            value={parameters.keepAlive ?? ""}
            onChange={(e) => update("keepAlive", e.target.value || undefined)}
            className="h-8 text-xs"
          />

          <Input
            label={t("stop")}
            type="text"
            placeholder={t("stopPlaceholder")}
            value={parameters.stop ?? ""}
            onChange={(e) => update("stop", e.target.value || undefined)}
            className="h-8 text-xs"
          />

          <div className="col-span-2 md:col-span-3">
            <Textarea
              label={t("systemPrompt")}
              value={parameters.systemPrompt ?? ""}
              onChange={(e) =>
                update("systemPrompt", e.target.value || undefined)
              }
              placeholder={t("systemPromptPlaceholder")}
              rows={2}
              className="text-xs"
            />
          </div>

          <div className="flex items-end">
            <Button variant="ghost" size="sm" onClick={reset}>
              <RotateCcw className="mr-1 h-3 w-3" />
              {t("reset")}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
