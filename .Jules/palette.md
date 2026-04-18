## 2026-04-08 - Add keyboard focus visible states
**Learning:** The UI components lacked `:focus-visible` states for buttons, making keyboard navigation difficult to track visually without adding distracting `:focus` states for mouse users.
**Action:** Always add `:focus-visible` styling (using standard VS Code variables like `--vscode-focusBorder`) to interactive elements like buttons to improve keyboard accessibility.
## 2023-10-27 - Webview Mocking
**Learning:** When visually verifying VS Code Webview frontend changes via Playwright, the UI may not render correctly without accurately mocking the asynchronous state updates sent via `window.postMessage` from the extension backend.
**Action:** Include a `page.evaluate()` block to dispatch a mock `STATE_UPDATE` message when creating Playwright scripts for frontend verification.
## 2026-04-11 - Explicit label association and disabled state tooltips
**Learning:** Found instances where input elements like checkboxes lacked explicit ID to label associations, which hinders screen reader support. Additionally, disabled complex functionality (like Hot Reloading without DCEVM) lacked context, leaving users unsure why they couldn't use it.
**Action:** Always associate labels with inputs using `htmlFor` and `id`, and provide a `title` or tooltip on container elements for disabled inputs to explain to users why it is disabled.
## 2024-05-18 - Input error state accessibility
**Learning:** Found an input field where the only feedback for an invalid value was a disabled submit button. This is confusing for users and completely inaccessible for screen readers.
**Action:** When adding validation to input fields, always provide an inline validation message with `role="alert"`, and link it to the input using `aria-invalid` and `aria-describedby` to ensure screen reader compatibility.
## 2025-04-18 - Missing focus visibility on custom tree headers
**Learning:** Custom interactive elements (e.g., custom tree headers using `role="button"` and `tabIndex={0}`) in VSCode Webviews frequently miss native focus rings despite having hover states.
**Action:** When implementing custom `role="button"` elements in VSCode Webviews, always explicitly add `:focus-visible` styling using `--vscode-focusBorder` to ensure keyboard accessibility.
