# electron-bun-starter

A small monorepo starter for building one React experience that runs in the browser and in an Electron desktop shell.

The desktop shell starts a local Bun server and loads the same web page as the browser app. Feature code talks to the server over HTTP, so domain behavior stays in Bun instead of being split across Electron IPC handlers.

## Layout

- `apps/server` — Bun.serve server with Effect services and HTTP contracts.
- `apps/web` — Vite React entry point.
- `apps/electron` — minimal Electron lifecycle shell; no feature IPC.
- `packages/app` — shared React page used by web and desktop.
- `packages/contracts` — Effect Schema API contracts.
- `packages/shared` — shared typed API client and runtime helpers.
- `packages/ui` — shadcn-style primitives and Tailwind theme tokens.

## Commands

```sh
bun install
bun run dev            # Vite web + Electron; Electron starts the Bun server
bun run build          # Build web, Bun server, and Electron main process
bun run check          # Typecheck and run package tests
bun run package:win    # Build and create NSIS + portable Windows packages
```

`bun run package:win` creates both Windows installer formats in `artifacts/`:

- `Electron-Bun-Starter-0.1.0-x64.exe` — an NSIS installer.
- `Electron-Bun-Starter-0.1.0-x64-portable.exe` — a portable executable.

The package includes the Vite renderer and a compiled Windows Bun server, so end users do not need Bun or the source repository installed. Use `bun run package:win:dir` when you only need the unpacked Windows application directory. Packaging is currently unsigned; Windows SmartScreen may show a warning until a production code-signing certificate is configured.

The Agentic OS marker is intentionally ignored in `.gitignore`; registration remains local to the workspace daemon.
