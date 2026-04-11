## 2025-04-08 - Asynchronous Validation in VS Code Extension Host
**Learning:** `child_process.spawnSync` blocks the single Node.js event loop of the VS Code extension host. This causes the entire UI (and any background tasks) to freeze while waiting for synchronous shell commands like checking Gradle or JDK versions to finish.
**Action:** Use `child_process.spawn` wrapped in a `Promise` for shell commands that might take time. Combine independent asynchronous tasks using `Promise.all` to run them concurrently, significantly reducing total execution time and preventing UI freezes.## 2025-04-09 - Asynchronous child_process execution
**Learning:** Found more instances of blocking `child_process.execFileSync` calls (`netstat`, `taskkill`, `reg`) in the VS Code extension host, which can block the single Node.js event loop.
**Action:** Replaced them with `util.promisify(execFile)` to execute system commands asynchronously without blocking the UI. Awaiting these methods ensures correct operation order without the performance penalty of synchronous calls.
## 2025-04-10 - Asynchronous File Reading
**Learning:** Found multiple instances of `fs.readFileSync` in the VS Code extension host (`ValidationService` and `UnifiedPanelProvider`), which blocks the single Node.js event loop during initialization and validation processes, freezing the UI.
**Action:** Replaced synchronous reads with `await fs.promises.readFile` and updated corresponding method signatures to be asynchronous. Always avoid synchronous I/O operations in backend services.
## 2025-04-11 - Asynchronous HTML Loading for Webview
**Learning:** Discovered a performance bottleneck where `fs.readFileSync` and `fs.existsSync` were blocking the Node.js event loop during the loading of the Webview HTML. While this might not seem significant, the extension host shouldn't block its main thread for I/O operations.
**Action:** Replaced the synchronous file system operations with asynchronous `await fs.promises.readFile()` in `src/panels/WebviewProvider.ts` to improve loading performance and prevent UI freezing.
