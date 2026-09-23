import { contextBridge, ipcRenderer } from "electron";

try {
  contextBridge.exposeInMainWorld("serverApi", Object.freeze({
    getHealth: () => ipcRenderer.invoke("server:get-health"),
    getWelcome: () => ipcRenderer.invoke("server:get-welcome"),
  }));
} catch {
  console.error("Failed to expose serverApi");
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
