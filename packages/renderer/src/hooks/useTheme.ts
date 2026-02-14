import { useState, useEffect, useCallback } from "react";

export interface UseThemeReturn {
  mode: "light" | "dark";
  isDark: boolean;
  toggle: () => void;
}

function getSystemPreference(): "light" | "dark" {
  if (
    typeof window !== "undefined" &&
    window.matchMedia("(prefers-color-scheme: dark)").matches
  ) {
    return "dark";
  }
  return "light";
}

export function useTheme(
  defaultMode: "light" | "dark" | "auto"
): UseThemeReturn {
  const [manualOverride, setManualOverride] = useState<
    "light" | "dark" | null
  >(null);
  const [systemMode, setSystemMode] = useState<"light" | "dark">(() =>
    getSystemPreference()
  );

  // Resolve the initial mode
  const initialResolved =
    defaultMode === "auto" ? getSystemPreference() : defaultMode;
  const [mode, setMode] = useState<"light" | "dark">(initialResolved);

  // Listen for system preference changes
  useEffect(() => {
    if (typeof window === "undefined") return;

    const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");
    const handler = (e: MediaQueryListEvent): void => {
      setSystemMode(e.matches ? "dark" : "light");
    };

    mediaQuery.addEventListener("change", handler);
    return () => {
      mediaQuery.removeEventListener("change", handler);
    };
  }, []);

  // Recalculate resolved mode when system preference or manual override changes
  useEffect(() => {
    let resolved: "light" | "dark";
    if (manualOverride !== null) {
      resolved = manualOverride;
    } else if (defaultMode === "auto") {
      resolved = systemMode;
    } else {
      resolved = defaultMode;
    }
    setMode(resolved);
  }, [manualOverride, systemMode, defaultMode]);

  // Set data-theme attribute on document
  useEffect(() => {
    if (typeof document !== "undefined") {
      document.documentElement.setAttribute("data-theme", mode);
    }
  }, [mode]);

  const toggle = useCallback((): void => {
    setManualOverride((prev) => {
      const current = prev ?? mode;
      return current === "light" ? "dark" : "light";
    });
  }, [mode]);

  return {
    mode,
    isDark: mode === "dark",
    toggle,
  };
}
