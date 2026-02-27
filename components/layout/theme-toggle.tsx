"use client";

import { useTheme } from "next-themes";
import { useEffect, useState } from "react";

export function ThemeToggle() {
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);

  if (!mounted) return null;

  const modes = ["light", "dark", "system"] as const;
  const labels: Record<string, string> = {
    light: "☀ Light",
    dark: "🌙 Dark",
    system: "💻 Auto",
  };

  return (
    <div className="flex gap-1">
      {modes.map((mode) => (
        <button
          key={mode}
          onClick={() => setTheme(mode)}
          aria-label={`Switch to ${mode} theme`}
          className={`flex-1 rounded-md px-2 py-1.5 text-xs transition-colors ${
            theme === mode
              ? "bg-[hsl(var(--accent))] font-medium"
              : "hover:bg-[hsl(var(--accent))]"
          }`}
        >
          {labels[mode]}
        </button>
      ))}
    </div>
  );
}
