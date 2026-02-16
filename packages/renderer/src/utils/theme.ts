import type { ThemeConfig } from "@formant/core";
import type { CSSProperties } from "react";

/** Parse hex to RGB. Supports #rgb and #rrggbb. */
function hexToRgb(hex: string): { r: number; g: number; b: number } | null {
  const normalized = hex.startsWith("#") ? hex.slice(1) : hex;
  if (normalized.length === 3) {
    const r = parseInt(normalized[0] + normalized[0], 16);
    const g = parseInt(normalized[1] + normalized[1], 16);
    const b = parseInt(normalized[2] + normalized[2], 16);
    return isNaN(r) || isNaN(g) || isNaN(b) ? null : { r, g, b };
  }
  if (normalized.length === 6) {
    const r = parseInt(normalized.slice(0, 2), 16);
    const g = parseInt(normalized.slice(2, 4), 16);
    const b = parseInt(normalized.slice(4, 6), 16);
    return isNaN(r) || isNaN(g) || isNaN(b) ? null : { r, g, b };
  }
  return null;
}

/** Darken a hex color by a factor (0–1). 0.1 = 10% darker. */
function darkenHex(hex: string, amount: number = 0.1): string {
  const rgb = hexToRgb(hex);
  if (!rgb) return hex;
  const r = Math.max(0, Math.min(255, Math.round(rgb.r * (1 - amount))));
  const g = Math.max(0, Math.min(255, Math.round(rgb.g * (1 - amount))));
  const b = Math.max(0, Math.min(255, Math.round(rgb.b * (1 - amount))));
  return `#${r.toString(16).padStart(2, "0")}${g.toString(16).padStart(2, "0")}${b.toString(16).padStart(2, "0")}`;
}

/** Convert hex to rgba with given alpha. */
function hexToRgba(hex: string, alpha: number): string {
  const rgb = hexToRgb(hex);
  if (!rgb) return hex;
  return `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, ${alpha})`;
}

/**
 * Build CSS custom property overrides from ThemeConfig.
 * Derives accentHover from accent if not provided.
 * Derives accentGlow (rgba) from accent for selected-state backgrounds.
 */
export function buildThemeStyle(theme: ThemeConfig | undefined): React.CSSProperties {
  if (!theme?.accent) return {};

  const accent = theme.accent;
  const accentHover = theme.accentHover ?? darkenHex(accent, 0.1);
  const accentGlow = hexToRgba(accent, 0.12);

  const style: Record<string, string> = {
    "--ff-accent": accent,
    "--ff-accent-hover": accentHover,
    "--ff-accent-glow": accentGlow,
  };

  if (theme.radius) {
    style["--ff-radius"] = theme.radius;
  }

  return style as CSSProperties;
}
