"use client";

import { useCallback } from "react";
import { useToast } from "@/components/ui/toast";

export function useUnloadModel(
  t: (key: string, values?: Record<string, string>) => string
) {
  const { toast } = useToast();

  return useCallback(
    async (model: string, serverId: string) => {
      if (!model || !serverId) return;
      try {
        const res = await fetch(
          `/api/proxy/api/generate?serverId=${serverId}`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ model, keep_alive: 0 }),
          }
        );
        if (!res.ok) throw new Error();
        toast(t("unloadSuccess", { model }), "success");
      } catch {
        toast(t("unloadError"), "error");
      }
    },
    [t, toast]
  );
}
