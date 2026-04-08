## 2026-04-08 - Add keyboard focus visible states
**Learning:** The UI components lacked `:focus-visible` states for buttons, making keyboard navigation difficult to track visually without adding distracting `:focus` states for mouse users.
**Action:** Always add `:focus-visible` styling (using standard VS Code variables like `--vscode-focusBorder`) to interactive elements like buttons to improve keyboard accessibility.
