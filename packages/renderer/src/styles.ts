export const formantStyles = `
/* 1. Google Fonts Import */
@import url('https://fonts.googleapis.com/css2?family=Outfit:wght@300;400;500&family=Space+Mono:wght@400&display=swap');

/* 2. :root variables (dark mode defaults) */
:root {
  --ff-bg: #0a0a0c;
  --ff-surface: #0e0e12;
  --ff-surface-hover: #131318;
  --ff-border: #1a1a1f;
  --ff-border-hover: #333;
  --ff-text: #e0e0e0;
  --ff-text-secondary: #666;
  --ff-text-muted: #444;
  --ff-text-faint: #333;
  --ff-accent: #6c5ce7;
  --ff-accent-hover: #5a4bd1;
  --ff-accent-glow: rgba(108, 92, 231, 0.12);
  --ff-error: #ff6b6b;
  --ff-success: #51cf66;
  --ff-radius: 10px;
  --ff-font-sans: 'Outfit', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
  --ff-font-mono: 'Space Mono', 'SF Mono', 'Fira Code', 'Fira Mono', monospace;
  --ff-transition: 0.2s ease;
  --ff-transition-slow: 0.4s cubic-bezier(0.16, 1, 0.3, 1);
}

/* 3. @media (prefers-color-scheme: light) overrides */
@media (prefers-color-scheme: light) {
  :root {
    --ff-bg: #fafafa;
    --ff-surface: #ffffff;
    --ff-surface-hover: #f5f5f5;
    --ff-border: #e5e5e5;
    --ff-border-hover: #ccc;
    --ff-text: #1a1a1a;
    --ff-text-secondary: #888;
    --ff-text-muted: #aaa;
    --ff-text-faint: #ddd;
    --ff-accent: #6c5ce7;
    --ff-accent-hover: #5a4bd1;
    --ff-accent-glow: rgba(108, 92, 231, 0.08);
    --ff-error: #e03131;
    --ff-success: #2f9e44;
  }
}

/* 4. [data-theme="light"] overrides (manual toggle — overrides media query) */
[data-theme="light"] {
  --ff-bg: #fafafa;
  --ff-surface: #ffffff;
  --ff-surface-hover: #f5f5f5;
  --ff-border: #e5e5e5;
  --ff-border-hover: #ccc;
  --ff-text: #1a1a1a;
  --ff-text-secondary: #888;
  --ff-text-muted: #aaa;
  --ff-text-faint: #ddd;
  --ff-accent: #6c5ce7;
  --ff-accent-hover: #5a4bd1;
  --ff-accent-glow: rgba(108, 92, 231, 0.08);
  --ff-error: #e03131;
  --ff-success: #2f9e44;
}

/* 5. [data-theme="dark"] overrides (manual toggle — overrides media query) */
[data-theme="dark"] {
  --ff-bg: #0a0a0c;
  --ff-surface: #0e0e12;
  --ff-surface-hover: #131318;
  --ff-border: #1a1a1f;
  --ff-border-hover: #333;
  --ff-text: #e0e0e0;
  --ff-text-secondary: #666;
  --ff-text-muted: #444;
  --ff-text-faint: #333;
  --ff-accent: #6c5ce7;
  --ff-accent-hover: #5a4bd1;
  --ff-accent-glow: rgba(108, 92, 231, 0.12);
  --ff-error: #ff6b6b;
  --ff-success: #51cf66;
}

/* 6. Reset */
*, *::before, *::after { margin: 0; padding: 0; box-sizing: border-box; }

/* 7. Base */
html, body {
  height: 100%;
  font-family: var(--ff-font-sans);
  background: var(--ff-bg);
  color: var(--ff-text);
  -webkit-font-smoothing: antialiased;
}

#root {
  min-height: 100vh;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 40px 24px;
}

/* 8. Progress bar */
.ff-progress { position: fixed; top: 0; left: 0; width: 100%; height: 2px; z-index: 100; }
.ff-progress-bar { height: 100%; background: var(--ff-accent); transition: width var(--ff-transition-slow); }

/* 9. Question container + transition states */
.ff-question-container { max-width: 600px; width: 100%; }
.ff-transition { }
.ff-transition-entering { opacity: 0; transform: translateY(20px); }
.ff-transition-active { opacity: 1; transform: translateY(0); transition: all var(--ff-transition-slow); }
.ff-transition-exiting { opacity: 0; transform: translateY(-20px); transition: all var(--ff-transition); }

/* 10. Typography */
.ff-question-number {
  font-family: var(--ff-font-mono);
  font-size: 9px;
  text-transform: uppercase;
  letter-spacing: 3px;
  color: var(--ff-text-secondary);
  margin-bottom: 16px;
}

.ff-question-title {
  font-family: var(--ff-font-sans);
  font-weight: 500;
  font-size: 22px;
  margin-bottom: 8px;
}

.ff-question-subtitle {
  font-family: var(--ff-font-sans);
  font-weight: 300;
  font-size: 15px;
  color: var(--ff-text-secondary);
  margin-bottom: 32px;
}

/* 10b. Welcome screen */
.ff-welcome {
  text-align: center;
}

.ff-welcome-title {
  font-family: var(--ff-font-sans);
  font-weight: 300;
  font-size: 28px;
}

.ff-welcome-subtitle {
  font-family: var(--ff-font-sans);
  font-weight: 300;
  font-size: 15px;
  color: var(--ff-text-secondary);
  margin-top: 12px;
}

.ff-welcome-btn {
  margin-top: 40px;
  padding: 12px 28px;
  background: var(--ff-accent);
  color: white;
  border: none;
  border-radius: 8px;
  font-family: var(--ff-font-sans);
  font-size: 15px;
  cursor: pointer;
  transition: all var(--ff-transition);
}

.ff-welcome-btn:hover {
  background: var(--ff-accent-hover);
  transform: translateY(-1px);
}

.ff-welcome-btn:active {
  transform: translateY(0);
}

/* 11. Input styles */
.ff-input-underline {
  border: none;
  border-bottom: 1px solid var(--ff-border);
  background: transparent;
  font-size: 18px;
  font-family: var(--ff-font-sans);
  color: var(--ff-text);
  padding: 12px 0;
  width: 100%;
  outline: none;
}

.ff-input-underline:focus {
  border-color: var(--ff-accent);
}

.ff-textarea {
  border: 1px solid var(--ff-border);
  border-radius: var(--ff-radius);
  background: transparent;
  font-size: 18px;
  font-family: var(--ff-font-sans);
  color: var(--ff-text);
  padding: 16px;
  width: 100%;
  outline: none;
  resize: vertical;
}

.ff-textarea:focus {
  border-color: var(--ff-accent);
}

.ff-textarea-actions {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-top: 20px;
}

.ff-textarea-ok {
  background: var(--ff-accent);
  color: white;
  border: none;
  padding: 10px 20px;
  border-radius: 8px;
  font-family: var(--ff-font-sans);
  font-size: 14px;
  cursor: pointer;
  transition: all var(--ff-transition);
}

.ff-textarea-ok:hover {
  background: var(--ff-accent-hover);
  transform: translateY(-1px);
}

.ff-textarea-ok:active {
  transform: translateY(0);
}

.ff-date-input {
  border: none;
  border-bottom: 1px solid var(--ff-border);
  background: transparent;
  font-size: 18px;
  font-family: var(--ff-font-sans);
  color: var(--ff-text);
  padding: 12px 0;
  width: 100%;
  outline: none;
  color-scheme: dark;
}

.ff-date-input:focus {
  border-color: var(--ff-accent);
}

@media (prefers-color-scheme: light) {
  .ff-date-input { color-scheme: light; }
}

[data-theme="light"] .ff-date-input { color-scheme: light; }
[data-theme="dark"] .ff-date-input { color-scheme: dark; }

/* 12. Choice cards + stagger animation */
.ff-choice-list {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.ff-choice-card {
  border: 1px solid var(--ff-border);
  padding: 28px 24px;
  border-radius: var(--ff-radius);
  cursor: pointer;
  display: flex;
  align-items: center;
  gap: 16px;
  transition: all var(--ff-transition);
  animation: ff-stagger-in 0.3s ease forwards;
  opacity: 0;
}

.ff-choice-card:hover {
  border-color: var(--ff-border-hover);
  background: var(--ff-surface-hover);
  transform: translateY(-2px);
}

.ff-choice-card--selected {
  border-color: var(--ff-accent);
  background: var(--ff-accent-glow);
}

.ff-choice-key {
  font-family: var(--ff-font-mono);
  font-size: 11px;
  border: 1px solid var(--ff-border);
  border-radius: 4px;
  padding: 2px 8px;
  min-width: 28px;
  text-align: center;
}

@keyframes ff-stagger-in {
  from { opacity: 0; transform: translateY(10px); }
  to { opacity: 1; transform: translateY(0); }
}

/* 12b. Multi-choice (select-all-that-apply) */
.ff-multi-list {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
  margin-top: 8px;
}

.ff-multi-card {
  border: 1px solid var(--ff-border);
  padding: 10px 18px;
  border-radius: var(--ff-radius);
  cursor: pointer;
  display: inline-flex;
  align-items: center;
  gap: 10px;
  background: transparent;
  color: var(--ff-text);
  font-family: var(--ff-font-sans);
  font-size: 14px;
  transition: all var(--ff-transition);
  animation: ff-stagger-in 0.3s ease forwards;
  opacity: 0;
}

.ff-multi-card:hover {
  border-color: var(--ff-border-hover);
  background: var(--ff-surface-hover);
  transform: translateY(-1px);
}

.ff-multi-card--selected {
  border-color: var(--ff-accent);
  background: var(--ff-accent-glow);
}

.ff-multi-check {
  display: inline-block;
  width: 16px;
  height: 16px;
  border: 1px solid var(--ff-border);
  border-radius: 3px;
  flex-shrink: 0;
  transition: all var(--ff-transition);
  position: relative;
}

.ff-multi-check--checked {
  background: var(--ff-accent);
  border-color: var(--ff-accent);
}

.ff-multi-check--checked::after {
  content: '';
  position: absolute;
  top: 2px;
  left: 5px;
  width: 4px;
  height: 8px;
  border-right: 2px solid white;
  border-bottom: 2px solid white;
  transform: rotate(45deg);
}

.ff-multi-continue {
  display: inline-block;
  margin-top: 20px;
  background: transparent;
  border: 1px solid var(--ff-border);
  color: var(--ff-text);
  padding: 8px 20px;
  border-radius: 8px;
  font-family: var(--ff-font-sans);
  font-size: 14px;
  cursor: pointer;
  transition: all var(--ff-transition);
}

.ff-multi-continue:hover {
  border-color: var(--ff-accent);
  background: var(--ff-accent-glow);
  transform: translateY(-1px);
}

/* 13. Rating stars */
.ff-rating-stars { display: flex; gap: 8px; }
.ff-star { font-size: 28px; cursor: pointer; transition: color var(--ff-transition); color: var(--ff-text-muted); }
.ff-star--filled { color: var(--ff-accent); }
.ff-star--hover { color: var(--ff-accent); opacity: 0.7; }

/* 14. Scale buttons */
.ff-scale-buttons { display: flex; gap: 8px; flex-wrap: wrap; }

.ff-scale-btn {
  font-family: var(--ff-font-mono);
  min-width: 44px;
  height: 44px;
  border: 1px solid var(--ff-border);
  border-radius: var(--ff-radius);
  cursor: pointer;
  background: transparent;
  color: var(--ff-text);
}

.ff-scale-btn:hover { background: var(--ff-surface-hover); }

.ff-scale-btn--selected {
  background: var(--ff-accent);
  color: white;
  border-color: var(--ff-accent);
}

.ff-scale-labels {
  display: flex;
  justify-content: space-between;
  margin-top: 8px;
  font-family: var(--ff-font-mono);
  font-size: 9px;
  color: var(--ff-text-muted);
}

/* 15. Yes/No cards */
.ff-yesno { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; }

.ff-yesno-card {
  border: 1px solid var(--ff-border);
  padding: 40px 24px;
  border-radius: var(--ff-radius);
  cursor: pointer;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 16px;
  transition: all var(--ff-transition);
  text-align: center;
}

.ff-yesno-card:hover {
  border-color: var(--ff-border-hover);
  background: var(--ff-surface-hover);
  transform: translateY(-2px);
}

.ff-yesno-card--selected {
  border-color: var(--ff-accent);
  background: var(--ff-accent-glow);
}

.ff-yesno-hint {
  font-family: var(--ff-font-mono);
  font-size: 11px;
  color: var(--ff-text-muted);
  margin-top: 8px;
}

/* 16. Dropdown */
.ff-dropdown { position: relative; }

.ff-dropdown-trigger {
  border: none;
  border-bottom: 1px solid var(--ff-border);
  background: transparent;
  font-size: 18px;
  font-family: var(--ff-font-sans);
  color: var(--ff-text);
  padding: 12px 0;
  width: 100%;
  outline: none;
  cursor: pointer;
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.ff-dropdown-trigger:focus {
  border-color: var(--ff-accent);
}

.ff-dropdown-list {
  position: absolute;
  top: 100%;
  left: 0;
  width: 100%;
  background: var(--ff-surface);
  border: 1px solid var(--ff-border);
  border-radius: var(--ff-radius);
  max-height: 240px;
  overflow-y: auto;
  z-index: 10;
}

.ff-dropdown-option {
  padding: 12px 16px;
  cursor: pointer;
}

.ff-dropdown-option:hover {
  background: var(--ff-surface-hover);
}

.ff-dropdown-option--highlighted {
  background: var(--ff-accent-glow);
}

.ff-dropdown-search {
  position: sticky;
  top: 0;
  padding: 12px 16px;
  border-bottom: 1px solid var(--ff-border);
  background: var(--ff-surface);
}

/* 17. Buttons */
.ff-btn-primary {
  background: var(--ff-accent);
  color: white;
  border: none;
  padding: 10px 24px;
  border-radius: 8px;
  font-family: var(--ff-font-sans);
  font-size: 14px;
  cursor: pointer;
  transition: all var(--ff-transition);
}

.ff-btn-primary:hover {
  background: var(--ff-accent-hover);
  transform: translateY(-1px);
}

.ff-btn-primary:active {
  transform: translateY(0);
}

.ff-btn-ghost {
  background: transparent;
  border: 1px solid var(--ff-border);
  color: var(--ff-text);
  padding: 10px 24px;
  border-radius: 8px;
  font-family: var(--ff-font-sans);
  font-size: 14px;
  cursor: pointer;
  transition: all var(--ff-transition);
}

.ff-btn-ghost:hover {
  border-color: var(--ff-border-hover);
  background: var(--ff-surface-hover);
}

/* 18. Error state + shake animation */
.ff-error-message {
  color: var(--ff-error);
  font-family: var(--ff-font-mono);
  font-size: 9px;
  text-transform: uppercase;
  letter-spacing: 3px;
  margin-top: 12px;
  animation: ff-shake 0.3s ease;
}

@keyframes ff-shake {
  0%, 100% { transform: translateX(0); }
  25% { transform: translateX(-4px); }
  75% { transform: translateX(4px); }
}

/* 19. Keyboard hints */
.ff-keyboard-hint {
  position: fixed;
  bottom: 24px;
  left: 50%;
  transform: translateX(-50%);
  display: flex;
  gap: 8px;
  align-items: center;
}

.ff-keyboard-hint kbd {
  font-family: var(--ff-font-mono);
  font-size: 11px;
  color: var(--ff-text-muted);
  border: 1px solid var(--ff-border);
  border-radius: 4px;
  padding: 2px 8px;
  background: var(--ff-surface);
}

/* 20. Back button + Theme toggle */
.ff-back-btn {
  position: fixed;
  top: 16px;
  left: 16px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: transparent;
  border: 1px solid var(--ff-border);
  border-radius: 8px;
  padding: 8px 12px;
  cursor: pointer;
  font-family: var(--ff-font-sans);
  font-size: 20px;
  line-height: 1;
  color: var(--ff-text);
  z-index: 100;
  transition: all var(--ff-transition);
}

.ff-back-btn:hover {
  border-color: var(--ff-border-hover);
  color: var(--ff-text);
}

/* Theme toggle */
.ff-theme-toggle {
  position: fixed;
  top: 16px;
  right: 16px;
  background: transparent;
  border: 1px solid var(--ff-border);
  border-radius: 20px;
  padding: 6px 12px;
  cursor: pointer;
  font-family: var(--ff-font-mono);
  color: var(--ff-text-muted);
  z-index: 100;
}

.ff-theme-toggle:hover {
  border-color: var(--ff-border-hover);
}

/* 21. Ending screen + checkmark animation */
.ff-ending {
  text-align: center;
  display: flex;
  flex-direction: column;
  align-items: center;
}

.ff-ending-circle {
  width: 64px;
  height: 64px;
  border-radius: 50%;
  border: 2px solid var(--ff-accent);
  background: var(--ff-accent-glow);
  display: flex;
  align-items: center;
  justify-content: center;
  animation: ff-scale-in 0.3s ease;
  margin-bottom: 24px;
}

.ff-ending-check {
  width: 20px;
  height: 10px;
  border-left: 2px solid var(--ff-accent);
  border-bottom: 2px solid var(--ff-accent);
  transform: rotate(-45deg) translateY(-2px);
  animation: ff-check-draw 0.2s ease 0.3s forwards;
  opacity: 0;
}

@keyframes ff-scale-in { from { transform: scale(0); } to { transform: scale(1); } }
@keyframes ff-check-draw { to { opacity: 1; } }

.ff-ending-summary {
  margin-top: 32px;
  width: 100%;
  max-width: 480px;
}

.ff-ending-summary-item {
  display: flex;
  justify-content: space-between;
  padding: 12px 0;
  border-bottom: 1px solid var(--ff-border);
}

.ff-ending-redirect {
  display: inline-block;
  margin-top: 16px;
  color: var(--ff-accent);
  text-decoration: none;
  font-family: var(--ff-font-sans);
  font-size: 15px;
  transition: color var(--ff-transition);
}

.ff-ending-redirect:hover {
  color: var(--ff-accent-hover);
  text-decoration: underline;
}

/* Error circle (cross mark) */
.ff-ending-circle--error {
  border-color: var(--ff-error);
  background: rgba(255, 107, 107, 0.12);
}

.ff-ending-cross {
  width: 20px;
  height: 20px;
  position: relative;
  animation: ff-check-draw 0.2s ease 0.3s forwards;
  opacity: 0;
}

.ff-ending-cross::before,
.ff-ending-cross::after {
  content: '';
  position: absolute;
  top: 50%;
  left: 50%;
  width: 18px;
  height: 2px;
  background: var(--ff-error);
  border-radius: 1px;
}

.ff-ending-cross::before {
  transform: translate(-50%, -50%) rotate(45deg);
}

.ff-ending-cross::after {
  transform: translate(-50%, -50%) rotate(-45deg);
}

/* Submit status messages */
.ff-submit-status {
  margin-top: 16px;
  font-family: var(--ff-font-mono);
  font-size: 9px;
  text-transform: uppercase;
  letter-spacing: 3px;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
}

.ff-submit-status--pending {
  color: var(--ff-text-muted);
}

.ff-submit-status--success {
  color: var(--ff-success);
}

.ff-submit-status--warning {
  color: var(--ff-text-secondary);
}

.ff-submit-status--error {
  color: var(--ff-error);
}

.ff-submit-details {
  margin-top: 6px;
  font-size: 9px;
  letter-spacing: 2px;
  color: var(--ff-text-muted);
  text-align: center;
}

.ff-submit-detail-item {
  padding: 2px 0;
}

/* Spinner for submitting state */
.ff-submit-spinner {
  display: inline-block;
  width: 14px;
  height: 14px;
  border: 2px solid var(--ff-border);
  border-top-color: var(--ff-accent);
  border-radius: 50%;
  animation: ff-spin 0.6s linear infinite;
}

@keyframes ff-spin {
  to { transform: rotate(360deg); }
}

/* Download button on ending screen */
.ff-ending-download {
  margin-top: 20px;
}

/* 22. Responsive */
@media (max-width: 640px) {
  #root { padding: 24px 16px; }
  .ff-question-title { font-size: 18px; }
  .ff-yesno { grid-template-columns: 1fr; }
  .ff-choice-card { padding: 20px 16px; }
  .ff-multi-list { gap: 8px; }
  .ff-multi-card { padding: 8px 14px; font-size: 13px; }
  .ff-scale-buttons { gap: 4px; }
  .ff-scale-btn { min-width: 36px; height: 36px; }
}
`;
