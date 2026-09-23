import { join } from "node:path";
import { createServer, type ViteDevServer } from "vite";

export async function startWebDevServer(root: string, port: number): Promise<ViteDevServer> {
  const originalWorkingDirectory = process.cwd();
  let server: ViteDevServer | undefined;

  process.chdir(root);
  try {
    server = await createServer({
      configFile: join(root, "vite.config.ts"),
      root,
      server: { host: "127.0.0.1", port, strictPort: true },
    });
    await server.listen();
    server.printUrls();
    return server;
  } catch (error) {
    await server?.close();
    throw error;
  } finally {
    process.chdir(originalWorkingDirectory);
  }
}
