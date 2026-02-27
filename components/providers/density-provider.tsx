"use client";

import { createContext, useContext, useEffect, useState, useCallback } from "react";

type Density = "compact" | "normal" | "spacious";

interface DensityContextType {
  density: Density;
  setDensity: (d: Density) => void;
}

const DensityContext = createContext<DensityContextType>({
  density: "normal",
  setDensity: () => {},
});

export function useDensity() {
  return useContext(DensityContext);
}

const DENSITY_KEY = "ui-density";

const DENSITY_VARS: Record<Density, Record<string, string>> = {
  compact: {
    "--density-spacing-xs": "0.125rem",
    "--density-spacing-sm": "0.25rem",
    "--density-spacing-md": "0.5rem",
    "--density-spacing-lg": "0.75rem",
    "--density-spacing-xl": "1rem",
    "--density-text-sm": "0.75rem",
    "--density-text-base": "0.8125rem",
    "--density-row-height": "2rem",
  },
  normal: {
    "--density-spacing-xs": "0.25rem",
    "--density-spacing-sm": "0.5rem",
    "--density-spacing-md": "0.75rem",
    "--density-spacing-lg": "1rem",
    "--density-spacing-xl": "1.5rem",
    "--density-text-sm": "0.8125rem",
    "--density-text-base": "0.875rem",
    "--density-row-height": "2.5rem",
  },
  spacious: {
    "--density-spacing-xs": "0.5rem",
    "--density-spacing-sm": "0.75rem",
    "--density-spacing-md": "1rem",
    "--density-spacing-lg": "1.5rem",
    "--density-spacing-xl": "2rem",
    "--density-text-sm": "0.875rem",
    "--density-text-base": "1rem",
    "--density-row-height": "3rem",
  },
};

export function DensityProvider({ children }: { children: React.ReactNode }) {
  const [density, setDensityState] = useState<Density>("normal");

  useEffect(() => {
    const stored = localStorage.getItem(DENSITY_KEY) as Density | null;
    if (stored && DENSITY_VARS[stored]) {
      setDensityState(stored);
    }
  }, []);

  useEffect(() => {
    const vars = DENSITY_VARS[density];
    const root = document.documentElement;
    for (const [key, value] of Object.entries(vars)) {
      root.style.setProperty(key, value);
    }
    root.setAttribute("data-density", density);
  }, [density]);

  const setDensity = useCallback((d: Density) => {
    setDensityState(d);
    localStorage.setItem(DENSITY_KEY, d);
  }, []);

  return (
    <DensityContext.Provider value={{ density, setDensity }}>
      {children}
    </DensityContext.Provider>
  );
}
