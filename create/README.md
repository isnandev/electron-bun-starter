# create-electron-bun-starter

Scaffold a Bun + Electron + React application from the [Electron Bun Starter](https://github.com/isnandev/electron-bun-starter) template.

## Requirements

- [Bun](https://bun.sh/) 1.4 or newer.
- An internet connection to fetch the public GitHub template.

## Usage

```sh
bun create electron-bun-starter my-project
cd my-project
bun install
bun run dev
```

You can also create directly from GitHub, without the npm creator package:

```sh
bun create isnandev/electron-bun-starter my-project
```

The destination directory must not already exist. The generated project and its workspace packages are named after the destination directory. The root app is private by default so it cannot be accidentally published to npm.

## Included workspace

- `apps/web` — Vite + React browser app.
- `apps/electron` — Electron desktop shell.
- `apps/server` — local Bun HTTP server.
- `packages/app` — shared React app.
- `packages/contracts` — Effect Schema API contracts.
- `packages/shared` — typed API client and runtime helpers.
- `packages/ui` — shared UI primitives and styles.

Useful commands after scaffolding:

```sh
bun run dev
bun run build
bun run check
bun run package:win
```

## Publishing updates

This package is published as `create-electron-bun-starter`. npm does not allow publishing the same package version twice. Before publishing changes, increment `version` in `package.json`, then run from this directory:

```sh
npm publish --access public
```
