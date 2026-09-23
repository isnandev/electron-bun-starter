import { join } from "node:path";
import { createRequire } from "node:module";
import { resolvePorts, serverUrl, webUrl } from "../../../packages/shared/src/ports";
import { findAvailablePort, generateSessionToken } from "../../../packages/shared/src/ports-runtime";
import { startWebDevServer } from "../../web/devServer";
import { requestServerShutdown, waitForExit } from "./serverLifecycle";

const preferredPorts = resolvePorts(process.env);
const hasExplicitServerPort = Boolean(process.env.SERVER_PORT || process.env.PORT);
const requestedServerPort = hasExplicitServerPort ? preferredPorts.serverPort : 0;
const webPort = await findAvailablePort(preferredPorts.webPort);
const sessionToken = process.env.APP_AUTH_TOKEN ?? generateSessionToken();
const projectRoot = join(import.meta.dir, "..", "..", "..");
const externalRendererUrl = process.env.ELECTRON_RENDERER_URL;
const rendererUrl = externalRendererUrl ?? webUrl(webPort);
const electronExecutable = createRequire(import.meta.url)("electron") as string;

async function isRendererReady(url: string): Promise<boolean> {
  try {
    return (await fetch(url)).ok;
  } catch {
    return false;
  }
}

async function waitForRenderer(url: string): Promise<boolean> {
  for (let attempt = 0; attempt < 80; attempt += 1) {
    if (shutdownRequested) return false;
    if (await isRendererReady(url)) return true;
    await Bun.sleep(250);
  }
  return false;
}

function startBunServer(): ReturnType<typeof Bun.spawn> {
  return Bun.spawn(["bun", "run", "--watch", "apps/server/src/index.ts"], {
    cwd: projectRoot,
    env: {
      ...process.env,
      SERVER_PORT: String(requestedServerPort),
      PORT: String(requestedServerPort),
      WEB_PORT: String(webPort),
      APP_AUTH_TOKEN: sessionToken,
    },
    stdin: "inherit",
    stdout: "pipe",
    stderr: "inherit",
  });
}

async function waitForServerPort(server: ReturnType<typeof Bun.spawn>): Promise<number> {
  return new Promise((resolve, reject) => {
    let output = "";
    let settled = false;
    const timeout = setTimeout(() => finish(new Error("Bun server did not report its bound port")), 20_000);

    const finish = (error?: Error, port?: number) => {
      if (settled) return;
      settled = true;
      clearTimeout(timeout);
      if (error) reject(error);
      else if (port !== undefined) resolve(port);
    };

    const stdout = server.stdout;
    if (!stdout || typeof stdout === "number") {
      finish(new Error("Bun server stdout is unavailable"));
      return;
    }
    const reader = stdout.getReader();
    void (async () => {
      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) {
            finish(new Error("Bun server exited before reporting its bound port"));
            return;
          }
          const text = new TextDecoder().decode(value);
          process.stdout.write(text);
          output = `${output}${text}`.slice(-256);
          const match = /ELECTRON_BUN_SERVER_READY=(\d+)/.exec(output);
          if (match) finish(undefined, Number(match[1]));
        }
      } catch (error) {
        finish(error instanceof Error ? error : new Error(String(error)));
      }
    })();

    void server.exited.then((code) => {
      finish(new Error(`Bun server exited before binding (code ${code})`));
    });
  });
}

async function waitForServer(port: number): Promise<void> {
  for (let attempt = 0; attempt < 80; attempt += 1) {
    if (shutdownRequested) throw new Error("Startup interrupted");
    try {
      const response = await fetch(`${serverUrl(port)}/api/health`, {
        headers: { "x-app-token": sessionToken },
      });
      if (response.ok) return;
    } catch {
      // The Bun server is still starting.
    }
    await Bun.sleep(250);
  }
  throw new Error(`Bun server did not become ready on port ${port}`);
}

async function stopBunServer(): Promise<void> {
  if (serverStopPromise) return serverStopPromise;
  const server = serverProcess;
  if (!server) return;

  serverStopPromise = (async () => {
    if (serverPort !== undefined) await requestServerShutdown(serverPort, sessionToken);
    if (await waitForExit(server.exited, 2_500)) return;

    server.kill();
    await waitForExit(server.exited, 1_000);
  })();
  return serverStopPromise;
}

async function closeWebServer(): Promise<void> {
  if (webClosePromise) return webClosePromise;
  if (!webServer) return;

  webClosePromise = webServer.close();
  return webClosePromise;
}

async function shutdownServices(): Promise<void> {
  const results = await Promise.allSettled([closeWebServer(), stopBunServer()]);
  for (const result of results) {
    if (result.status === "rejected") console.error("Failed to close a development service cleanly", result.reason);
  }
}

const buildMain = Bun.spawn(["bun", "build", "src/main.ts", "--outfile", ".dev/main.cjs", "--target", "node", "--format", "cjs", "--external", "electron"], {
  cwd: join(projectRoot, "apps", "electron"),
  stdin: "inherit",
  stdout: "inherit",
  stderr: "inherit",
});
const buildPreload = Bun.spawn(["bun", "build", "src/preload.ts", "--outfile", ".dev/preload.cjs", "--target", "node", "--format", "cjs", "--external", "electron"], {
  cwd: join(projectRoot, "apps", "electron"),
  stdin: "inherit",
  stdout: "inherit",
  stderr: "inherit",
});

const [mainBuildExit, preloadBuildExit] = await Promise.all([buildMain.exited, buildPreload.exited]);
if (mainBuildExit !== 0 || preloadBuildExit !== 0) {
  process.exit(1);
}

let serverProcess: ReturnType<typeof Bun.spawn> | undefined;
let serverPort: number | undefined;
let webServer: Awaited<ReturnType<typeof startWebDevServer>> | undefined;
let electron: ReturnType<typeof Bun.spawn> | undefined;
let shutdownRequested = false;
let serverStopPromise: Promise<void> | undefined;
let webClosePromise: Promise<void> | undefined;
let receivedSignal: "SIGINT" | "SIGTERM" | undefined;

const handleSignal = (signal: "SIGINT" | "SIGTERM") => {
  if (shutdownRequested) return;
  shutdownRequested = true;
  receivedSignal = signal;
  electron?.kill(signal);
};
process.once("SIGINT", () => handleSignal("SIGINT"));
process.once("SIGTERM", () => handleSignal("SIGTERM"));

try {
  serverProcess = startBunServer();
  serverPort = await waitForServerPort(serverProcess);
  await waitForServer(serverPort);

  const rendererEnvironment = {
    ...process.env,
    SERVER_PORT: String(serverPort),
    PORT: String(serverPort),
    WEB_PORT: String(webPort),
    APP_AUTH_TOKEN: sessionToken,
  };
  Object.assign(process.env, rendererEnvironment);

  let rendererReady = externalRendererUrl ? await isRendererReady(rendererUrl) : false;
  if (shutdownRequested) throw new Error("Startup interrupted");
  if (!rendererReady) {
    webServer = await startWebDevServer(join(projectRoot, "apps", "web"), webPort);
    rendererReady = await waitForRenderer(rendererUrl);
  }

  if (!rendererReady) {
    throw new Error(`Renderer did not become ready at ${rendererUrl}. Start Vite with WEB_PORT=${webPort}.`);
  }
  if (shutdownRequested) throw new Error("Startup interrupted");

  const devPreloadPath = join(projectRoot, "apps", "electron", ".dev", "preload.cjs");

  electron = Bun.spawn([electronExecutable, ".dev/main.cjs"], {
    cwd: join(projectRoot, "apps", "electron"),
    env: {
      ...rendererEnvironment,
      ELECTRON_RUN_AS_NODE: undefined,
      ELECTRON_RENDERER_URL: rendererUrl,
      ELECTRON_RENDERER_READY: rendererReady ? "1" : "0",
      ELECTRON_PROJECT_ROOT: projectRoot,
      ELECTRON_PRELOAD_PATH: devPreloadPath,
      ELECTRON_SERVER_MANAGED: "1",
    },
    stdin: "inherit",
    stdout: "inherit",
    stderr: "inherit",
  });

  const exitCode = await electron.exited;
  await shutdownServices();
  process.exitCode = receivedSignal ? (receivedSignal === "SIGINT" ? 130 : 143) : exitCode;
} catch (error) {
  if (!shutdownRequested) console.error(error);
  await shutdownServices();
  process.exitCode = receivedSignal ? (receivedSignal === "SIGINT" ? 130 : 143) : 1;
}
