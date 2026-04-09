## 2026-04-08 - Add keyboard focus visible states
**Learning:** The UI components lacked `:focus-visible` states for buttons, making keyboard navigation difficult to track visually without adding distracting `:focus` states for mouse users.
**Action:** Always add `:focus-visible` styling (using standard VS Code variables like `--vscode-focusBorder`) to interactive elements like buttons to improve keyboard accessibility.
## 2023-10-27 - Webview Mocking
**Learning:** When visually verifying VS Code Webview frontend changes via Playwright, the UI may not render correctly without accurately mocking the asynchronous state updates sent via `window.postMessage` from the extension backend.
**Action:** Include a `page.evaluate()` block to dispatch a mock `STATE_UPDATE` message when creating Playwright scripts for frontend verification.
