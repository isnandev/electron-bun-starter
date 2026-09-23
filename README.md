# Electron Bun Starter

A Bun-powered monorepo starter for building one React application that runs in a browser and in an Electron desktop shell. The desktop app starts a local Bun server and loads the same Vite UI as the web app; feature logic communicates with the server over HTTP.

## Create a project

Requires [Bun](https://bun.sh/) 1.4 or newer. Choose either creation method:

```sh
# Create directly from the public GitHub repository
bun create isnandev/electron-bun-starter my-project

# Or use the npm creator package
bun create electron-bun-starter my-project
```

The destination directory must not already exist. The creator names the project and workspace packages after the destination folder and keeps the generated app private by default.

```sh
cd my-project
bun install
bun run dev
```

## What's included

- `apps/web` — Vite + React browser application.
- `apps/electron` — Electron desktop lifecycle shell and preload.
- `apps/server` — local Bun HTTP server with Effect services.
- `packages/app` — shared React experience used by web and desktop.
- `packages/contracts` — Effect Schema API contracts.
- `packages/shared` — typed API client and shared runtime helpers.
- `packages/ui` — shared UI primitives and Tailwind theme styles.

The Electron shell loads the same web experience as the browser build. The renderer talks to the local server over HTTP; feature behavior is kept in Bun instead of being split across Electron IPC handlers.

## Development commands

```sh
bun install
bun run dev            # Start the web app and Electron; Electron starts the Bun server
bun run dev:web        # Start only the Vite web app
bun run dev:server     # Start only the Bun server
bun run dev:electron   # Start only the Electron development shell
bun run build          # Build the web app, server, and Electron main process
bun run check          # Typecheck all packages and run tests
```

## Windows packaging

```sh
bun run package:win      # Build NSIS installer and portable executable
bun run package:win:dir   # Build an unpacked application directory
```

The Windows installer and portable executable are written to `artifacts/`. The package includes the Vite renderer and a compiled Windows Bun server, so end users do not need Bun or the source repository installed. Packaging is currently unsigned; Windows SmartScreen may show a warning until a production code-signing certificate is configured.

## Creator package

The npm creator package is maintained in [`create/`](create/). Its README documents usage and publishing. To release an update, bump the version in `create/package.json` and publish from that directory:

```sh
cd create
npm publish --access public
```
