import { contextBridge, ipcRenderer } from "electron";

let config: { apiUrl?: string; apiPort?: number; apiToken?: string } = {};
try {
  config = (ipcRenderer.sendSync("app:get-config") as typeof config) ?? {};
} catch {
  // If sync config call fails, window controls must still work
}

try {
  contextBridge.exposeInMainWorld("appConfig", Object.freeze({
    apiUrl: typeof config.apiUrl === "string" ? config.apiUrl : "",
    apiPort: typeof config.apiPort === "number" ? config.apiPort : 0,
    apiToken: typeof config.apiToken === "string" ? config.apiToken : "",
  }));
} catch {
  // Ignore if already exposed
}

try {
  contextBridge.exposeInMainWorld("windowControls", Object.freeze({
    minimize: () => {
      ipcRenderer.send("window:minimize");
    },
    toggleMaximize: () => {
      ipcRenderer.send("window:maximize-toggle");
    },
    close: () => {
      ipcRenderer.send("window:close");
    },
  }));
} catch (error) {
  console.error("Failed to expose windowControls:", error);
}
