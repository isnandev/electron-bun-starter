import { app, BrowserWindow, ipcMain } from "electron";
import { spawn, type ChildProcess } from "node:child_process";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { resolvePorts, serverUrl } from "../../../packages/shared/src/ports";
import { findAvailablePort, generateSessionToken } from "../../../packages/shared/src/ports-runtime";

let serverProcess: ChildProcess | undefined;
let serverPort: number | undefined;
let mainWindow: BrowserWindow | undefined;
const sessionToken = process.env.APP_AUTH_TOKEN ?? generateSessionToken();
let windowIsMaximized = false;

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

async function startServer(): Promise<number> {
  const { serverPort: preferredPort } = resolvePorts(process.env);
  const port = await findAvailablePort(preferredPort);
  serverPort = port;
  const runtime = serverCommand();
  serverProcess = spawn(runtime.command, runtime.args, {
    cwd: runtime.cwd,
    env: {
      ...process.env,
      SERVER_PORT: String(port),
      PORT: String(port),
      APP_AUTH_TOKEN: sessionToken,
    },
    stdio: app.isPackaged ? "ignore" : "inherit",
    windowsHide: app.isPackaged,
    shell: false,
  });
  return port;
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

  window.webContents.session.webRequest.onBeforeSendHeaders((details, callback) => {
    details.requestHeaders["X-Electron-Bun-Port"] = String(port);
    details.requestHeaders["x-app-token"] = sessionToken;
    callback({ cancel: false, requestHeaders: details.requestHeaders });
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

app.whenReady().then(() => {
  ipcMain.on("app:get-config", (event) => {
    event.returnValue = {
      apiUrl: serverPort ? `http://127.0.0.1:${serverPort}` : "",
      apiPort: serverPort ?? 0,
      apiToken: sessionToken,
    };
  });
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

app.on("before-quit", () => {
  serverProcess?.kill();
});
