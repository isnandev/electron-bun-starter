import { join } from "node:path";
import { resolvePorts, webUrl } from "../../../packages/shared/src/ports";
import { findAvailablePort, generateSessionToken } from "../../../packages/shared/src/ports-runtime";

const preferredPorts = resolvePorts(process.env);
const serverPort = await findAvailablePort(preferredPorts.serverPort);
const webPort = await findAvailablePort(preferredPorts.webPort);
const sessionToken = process.env.APP_AUTH_TOKEN ?? generateSessionToken();
const projectRoot = join(import.meta.dir, "..", "..", "..");
const rendererUrl = process.env.ELECTRON_RENDERER_URL ?? webUrl(webPort);
const rendererEnvironment = {
  ...process.env,
  SERVER_PORT: String(serverPort),
  PORT: String(serverPort),
  WEB_PORT: String(webPort),
  APP_AUTH_TOKEN: sessionToken,
};

async function isRendererReady(url: string): Promise<boolean> {
  try {
    return (await fetch(url)).ok;
  } catch {
    return false;
  }
}

async function waitForRenderer(url: string): Promise<boolean> {
  for (let attempt = 0; attempt < 80; attempt += 1) {
    if (await isRendererReady(url)) return true;
    await Bun.sleep(250);
  }
  return false;
}

function startWebServer(): ReturnType<typeof Bun.spawn> {
  return Bun.spawn(["bun", "run", "--cwd", "apps/web", "dev"], {
    cwd: projectRoot,
    env: rendererEnvironment,
    stdin: "inherit",
    stdout: "inherit",
    stderr: "inherit",
  });
}

const buildMain = Bun.spawn(["bun", "build", "src/main.ts", "--outfile", ".dev/main.cjs", "--target", "node", "--format", "cjs", "--external", "electron"], {
  stdin: "inherit",
  stdout: "inherit",
  stderr: "inherit",
});
const buildPreload = Bun.spawn(["bun", "build", "src/preload.ts", "--outfile", ".dev/preload.cjs", "--target", "node", "--format", "cjs", "--external", "electron"], {
  stdin: "inherit",
  stdout: "inherit",
  stderr: "inherit",
});

if ((await buildMain.exited) !== 0 || (await buildPreload.exited) !== 0) {
  process.exit(1);
}

let webProcess: ReturnType<typeof Bun.spawn> | undefined;
let rendererReady = await isRendererReady(rendererUrl);

if (!rendererReady) {
  webProcess = startWebServer();
  rendererReady = await waitForRenderer(rendererUrl);
}

if (!rendererReady) {
  webProcess?.kill();
  throw new Error(`Renderer did not become ready at ${rendererUrl}. Start Vite with WEB_PORT=${webPort}.`);
}

const devPreloadPath = join(projectRoot, "apps", "electron", ".dev", "preload.cjs");

const electron = Bun.spawn(["electron", ".dev/main.cjs"], {
  cwd: import.meta.dir.replace(/\\src$/, ""),
  env: {
    ...rendererEnvironment,
    ELECTRON_RUN_AS_NODE: undefined,
    ELECTRON_RENDERER_URL: rendererUrl,
    ELECTRON_RENDERER_READY: rendererReady ? "1" : "0",
    ELECTRON_PROJECT_ROOT: projectRoot,
    ELECTRON_PRELOAD_PATH: devPreloadPath,
  },
  stdin: "inherit",
  stdout: "inherit",
  stderr: "inherit",
});

const stop = () => {
  webProcess?.kill();
  electron.kill();
};
process.on("SIGINT", stop);
process.on("SIGTERM", stop);
const exitCode = await electron.exited;
webProcess?.kill();
process.exit(exitCode);
