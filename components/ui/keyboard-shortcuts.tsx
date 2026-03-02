"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { Keyboard, X } from "lucide-react";
import { Button } from "./button";
import { Modal } from "./modal";

interface Shortcut {
  keys: string[];
  description: string;
}

interface ShortcutGroup {
  title: string;
  shortcuts: Shortcut[];
}

export function KeyboardShortcuts() {
  const t = useTranslations("shortcuts");
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Open shortcuts modal with ? or Ctrl+/
      if (e.key === "?" || (e.ctrlKey && e.key === "/")) {
        e.preventDefault();
        setIsOpen(true);
      }
      // Close with Escape
      if (e.key === "Escape" && isOpen) {
        setIsOpen(false);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen]);

  const isMac = typeof navigator !== "undefined" && /Mac/.test(navigator.platform);
  const mod = isMac ? "⌘" : "Ctrl";

  const groups: ShortcutGroup[] = [
    {
      title: t("navigation"),
      shortcuts: [
        { keys: ["G", "D"], description: t("goToDashboard") },
        { keys: ["G", "C"], description: t("goToChat") },
        { keys: ["G", "M"], description: t("goToModels") },
        { keys: ["G", "S"], description: t("goToServers") },
        { keys: ["G", "L"], description: t("goToLogs") },
        { keys: ["/"], description: t("focusSearch") },
      ],
    },
    {
      title: t("chat"),
      shortcuts: [
        { keys: [mod, "Enter"], description: t("sendMessage") },
        { keys: ["Escape"], description: t("stopGeneration") },
        { keys: [mod, "N"], description: t("newConversation") },
        { keys: [mod, "E"], description: t("exportChat") },
      ],
    },
    {
      title: t("general"),
      shortcuts: [
        { keys: ["?"], description: t("showShortcuts") },
        { keys: [mod, "K"], description: t("commandPalette") },
        { keys: [mod, ","], description: t("openSettings") },
      ],
    },
  ];

  return (
    <>
      <Button
        variant="ghost"
        size="icon"
        onClick={() => setIsOpen(true)}
        title={t("showShortcuts")}
        aria-label={t("showShortcuts")}
      >
        <Keyboard className="h-5 w-5" />
      </Button>

      <Modal isOpen={isOpen} onClose={() => setIsOpen(false)} title={t("title")}>
        <div className="space-y-6">
          {groups.map((group) => (
            <div key={group.title}>
              <h3 className="text-sm font-medium text-muted-foreground mb-3">
                {group.title}
              </h3>
              <div className="space-y-2">
                {group.shortcuts.map((shortcut, i) => (
                  <div
                    key={i}
                    className="flex items-center justify-between py-1"
                  >
                    <span className="text-sm">{shortcut.description}</span>
                    <div className="flex items-center gap-1">
                      {shortcut.keys.map((key, j) => (
                        <span key={j}>
                          <kbd className="px-2 py-1 text-xs font-semibold bg-muted border rounded">
                            {key}
                          </kbd>
                          {j < shortcut.keys.length - 1 && (
                            <span className="mx-1 text-muted-foreground">+</span>
                          )}
                        </span>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
        <div className="mt-6 pt-4 border-t text-center">
          <p className="text-xs text-muted-foreground">
            {t("pressToClose")}
          </p>
        </div>
      </Modal>
    </>
  );
}
