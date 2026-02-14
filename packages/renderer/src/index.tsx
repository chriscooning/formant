// Main Component
export { Formant } from "./Formant";
export type { FormantProps } from "./Formant";

// Hooks
export { useFormEngine } from "./hooks/useFormEngine";
export type { UseFormEngineReturn } from "./hooks/useFormEngine";
export { useKeyboard } from "./hooks/useKeyboard";
export type { UseKeyboardConfig } from "./hooks/useKeyboard";
export { useTheme } from "./hooks/useTheme";
export type { UseThemeReturn } from "./hooks/useTheme";
export { useAutoSave } from "./hooks/useAutoSave";
export type { UseAutoSaveConfig, UseAutoSaveReturn } from "./hooks/useAutoSave";

// Shared Components
export { ProgressBar } from "./components/ProgressBar";
export type { ProgressBarProps } from "./components/ProgressBar";
export { TransitionWrapper } from "./components/TransitionWrapper";
export type { TransitionWrapperProps } from "./components/TransitionWrapper";
export { KeyboardHint } from "./components/KeyboardHint";
export type { KeyboardHintProps } from "./components/KeyboardHint";
export { ThemeToggle } from "./components/ThemeToggle";
export type { ThemeToggleProps } from "./components/ThemeToggle";
export { ErrorMessage } from "./components/ErrorMessage";
export type { ErrorMessageProps } from "./components/ErrorMessage";

// Submit
export { submitResponses } from "./submit/handler";
export type { SubmitResult } from "./submit/handler";
