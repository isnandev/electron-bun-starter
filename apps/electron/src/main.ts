import { app, BrowserWindow, ipcMain } from "electron";
import { spawn, type ChildProcess } from "node:child_process";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { resolvePorts, serverUrl } from "../../../packages/shared/src/ports";
import { generateSessionToken } from "../../../packages/shared/src/ports-runtime";
import { requestServerShutdown } from "./serverLifecycle";

let serverProcess: ChildProcess | undefined;
let serverPort: number | undefined;
let mainWindow: BrowserWindow | undefined;
const sessionToken = process.env.APP_AUTH_TOKEN ?? generateSessionToken();
let windowIsMaximized = false;
let quitAfterServerShutdown = false;
let serverShutdownStarted = false;

function projectRoot(): string {
  return process.env.ELECTRON_PROJECT_ROOT ?? join(__dirname, "..", "..", "..");
}

function resolvePreloadPath(): string {
  if (process.env.ELECTRON_PRELOAD_PATH && existsSync(process.env.ELECTRON_PRELOAD_PATH)) {
    return process.env.ELECTRON_PRELOAD_PATH;
  }

  const root = projectRoot();
  const candidates = [
    join(app.getAppPath(), "dist", "preload.cjs"),
    join(app.getAppPath(), ".dev", "preload.cjs"),
    join(root, "apps", "electron", ".dev", "preload.cjs"),
    join(root, "apps", "electron", "dist", "preload.cjs"),
    join(__dirname, "preload.cjs"),
  ];

  for (const candidate of candidates) {
    if (existsSync(candidate)) return candidate;
  }

  return join(app.getAppPath(), "dist", "preload.cjs");
}

function serverCommand(): { command: string; args: string[]; cwd: string } {
  if (app.isPackaged) {
    return {
      command: join(process.resourcesPath, "server", "server.exe"),
      args: [],
      cwd: app.getPath("userData"),
    };
  }

  return {
    command: process.platform === "win32" ? "bun.exe" : "bun",
    args: ["run", "--watch", "apps/server/src/index.ts"],
    cwd: projectRoot(),
  };
}

function waitForServerPort(child: ChildProcess): Promise<number> {
  return new Promise((resolve, reject) => {
    if (!child.stdout) {
      reject(new Error("Bun server stdout is unavailable"));
      return;
    }

    let output = "";
    let settled = false;
    const timeout = setTimeout(() => {
      finish(new Error("Bun server did not report its bound port"));
    }, 20_000);

    const finish = (error?: Error, port?: number) => {
      if (settled) return;
      settled = true;
      clearTimeout(timeout);
      if (error) reject(error);
      else if (port !== undefined) resolve(port);
    };

    child.stdout.on("data", (chunk: Buffer | string) => {
      const text = chunk.toString();
      if (!app.isPackaged) process.stdout.write(text);
      output = `${output}${text}`.slice(-256);
      const match = /ELECTRON_BUN_SERVER_READY=(\d+)/.exec(output);
      if (match) finish(undefined, Number(match[1]));
    });
    child.once("error", (error) => finish(error));
    child.once("exit", (code, signal) => {
      finish(new Error(`Bun server exited before binding (code ${code}, signal ${signal})`));
    });
  });
}

async function startServer(): Promise<number> {
  const hasExplicitServerPort = Boolean(process.env.SERVER_PORT || process.env.PORT);
  const preferredPort = hasExplicitServerPort ? resolvePorts(process.env).serverPort : 0;
  if (!app.isPackaged && process.env.ELECTRON_SERVER_MANAGED === "1") {
    serverPort = preferredPort;
    return preferredPort;
  }

  const runtime = serverCommand();
  serverProcess = spawn(runtime.command, runtime.args, {
    cwd: runtime.cwd,
    env: {
      ...process.env,
      SERVER_PORT: String(preferredPort),
      PORT: String(preferredPort),
      APP_AUTH_TOKEN: sessionToken,
    },
    stdio: ["ignore", "pipe", app.isPackaged ? "ignore" : "inherit"],
    windowsHide: app.isPackaged,
    shell: false,
  });
  serverPort = await waitForServerPort(serverProcess);
  return serverPort;
}

function waitForChildExit(child: ChildProcess, timeoutMs: number): Promise<boolean> {
  if (child.exitCode !== null || child.signalCode !== null || child.pid === undefined) return Promise.resolve(true);

  return new Promise((resolve) => {
    let settled = false;
    const finish = (didExit: boolean) => {
      if (settled) return;
      settled = true;
      clearTimeout(timeout);
      child.removeListener("exit", onExit);
      child.removeListener("error", onExit);
      resolve(didExit);
    };
    const onExit = () => finish(true);
    const timeout = setTimeout(() => finish(false), timeoutMs);
    child.once("exit", onExit);
    child.once("error", onExit);
  });
}

async function stopServerProcess(): Promise<void> {
  const child = serverProcess;
  if (!child) return;

  if (serverPort !== undefined) await requestServerShutdown(serverPort, sessionToken);

  let didExit = await waitForChildExit(child, 2_500);
  if (!didExit) {
    child.kill("SIGTERM");
    didExit = await waitForChildExit(child, 1_000);
  }
  if (!didExit) {
    child.kill("SIGKILL");
    await waitForChildExit(child, 1_000);
  }
  serverProcess = undefined;
}

async function waitForServer(port: number): Promise<void> {
  for (let attempt = 0; attempt < 80; attempt += 1) {
    try {
      const response = await fetch(`${serverUrl(port)}/api/health`, {
        headers: { "x-app-token": sessionToken },
      });
      if (response.ok) return;
    } catch {
      // The Bun server is still starting.
    }
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  throw new Error(`Bun server did not become ready on port ${port}`);
}

async function waitForRenderer(url: string): Promise<void> {
  for (let attempt = 0; attempt < 80; attempt += 1) {
    try {
      const response = await fetch(url);
      if (response.ok) return;
    } catch {
      // Vite is still starting.
    }
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  throw new Error(`Renderer did not become ready at ${url}`);
}

async function createWindow(): Promise<void> {
  const port = await startServer();
  await waitForServer(port);
  const window = new BrowserWindow({
    width: 1280,
    height: 820,
    minWidth: 960,
    minHeight: 640,
    backgroundColor: "#ffffff",
    frame: false,
    autoHideMenuBar: true,
    webPreferences: {
      preload: resolvePreloadPath(),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });
  mainWindow = window;
  window.on("closed", () => {
    mainWindow = undefined;
  });
  window.on("maximize", () => {
    windowIsMaximized = true;
    window.webContents.send("window:maximized-change", true);
  });
  window.on("unmaximize", () => {
    windowIsMaximized = false;
    window.webContents.send("window:maximized-change", false);
  });

  const rendererUrl = process.env.ELECTRON_RENDERER_URL;
  if (rendererUrl) {
    if (process.env.ELECTRON_RENDERER_READY !== "1" && /^https?:\/\//.test(rendererUrl)) {
      await waitForRenderer(rendererUrl);
    }
    for (let attempt = 0; attempt < 3; attempt += 1) {
      try {
        await window.loadURL(rendererUrl);
        return;
      } catch (error) {
        if (attempt === 2) throw error;
        if (/^https?:\/\//.test(rendererUrl)) await waitForRenderer(rendererUrl);
      }
    }
  } else {
    const rendererPath = app.isPackaged
      ? join(process.resourcesPath, "renderer", "index.html")
      : join(projectRoot(), "apps", "web", "dist", "index.html");
    await window.loadFile(rendererPath);
  }
}

function getTargetWindow(event?: Electron.IpcMainEvent): BrowserWindow | undefined {
  if (event) {
    const senderWin = BrowserWindow.fromWebContents(event.sender);
    if (senderWin) return senderWin;
  }
  return mainWindow ?? BrowserWindow.getFocusedWindow() ?? BrowserWindow.getAllWindows()[0];
}

async function requestServer(
  event: Electron.IpcMainInvokeEvent,
  endpoint: "/api/health" | "/api/welcome",
): Promise<unknown> {
  if (!mainWindow || event.sender !== mainWindow.webContents || event.senderFrame !== event.sender.mainFrame) {
    throw new Error("Server API is only available to the main application frame");
  }
  if (!serverPort) throw new Error("Bun server is not ready");

  const response = await fetch(`${serverUrl(serverPort)}${endpoint}`, {
    headers: { "x-app-token": sessionToken },
  });
  if (!response.ok) throw new Error(`Server request failed with status ${response.status}`);
  return response.json();
}

app.whenReady().then(() => {
  ipcMain.handle("server:get-health", (event) => requestServer(event, "/api/health"));
  ipcMain.handle("server:get-welcome", (event) => requestServer(event, "/api/welcome"));
  ipcMain.on("window:minimize", (event) => {
    const win = getTargetWindow(event);
    win?.minimize();
  });
  ipcMain.on("window:maximize-toggle", (event) => {
    const win = getTargetWindow(event);
    if (!win) return;
    if (win.isMaximized()) {
      win.unmaximize();
      windowIsMaximized = false;
    } else {
      win.maximize();
      windowIsMaximized = true;
    }
    win.webContents.send("window:maximized-change", windowIsMaximized);
  });
  ipcMain.on("window:close", (event) => {
    const win = getTargetWindow(event);
    win?.close();
  });
  return createWindow();
}).catch((error: unknown) => {
  console.error(error);
  app.quit();
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});

app.on("before-quit", (event) => {
  if (quitAfterServerShutdown || !serverProcess) return;
  event.preventDefault();
  if (serverShutdownStarted) return;

  serverShutdownStarted = true;
  void stopServerProcess()
    .catch((error: unknown) => console.error("Failed to stop the local server cleanly", error))
    .finally(() => {
      quitAfterServerShutdown = true;
      app.quit();
    });
});
