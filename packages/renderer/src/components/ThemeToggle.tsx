import React from "react";

export interface ThemeToggleProps {
  mode: "light" | "dark";
  onToggle: () => void;
}

export const ThemeToggle: React.FC<ThemeToggleProps> = ({
  mode,
  onToggle,
}) => {
  return (
    <button
      className="ff-theme-toggle"
      onClick={onToggle}
      type="button"
      aria-label={`Switch to ${mode === "light" ? "dark" : "light"} mode`}
    >
      {mode === "dark" ? "☀" : "●"}
    </button>
  );
};
