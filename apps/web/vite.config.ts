import { fileURLToPath, URL } from "node:url";
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig, loadEnv } from "vite";
import { resolvePorts } from "../../packages/shared/src/ports";

export default defineConfig(({ mode }) => {
  const environment = loadEnv(mode, process.cwd(), "");
  const { serverPort, webPort } = resolvePorts({ ...process.env, ...environment });
  const authToken = environment.APP_AUTH_TOKEN || process.env.APP_AUTH_TOKEN;

  return {
    base: "./",
    plugins: [react(), tailwindcss()],
    resolve: {
      alias: {
        "@": fileURLToPath(new URL("./src", import.meta.url)),
      },
    },
    server: {
      host: "127.0.0.1",
      port: webPort,
      strictPort: true,
      proxy: {
        "/api": {
          target: `http://127.0.0.1:${serverPort}`,
          changeOrigin: true,
          headers: authToken ? { "x-app-token": authToken } : {},
        },
      },
    },
    build: { outDir: "dist", emptyOutDir: true },
  };
});
