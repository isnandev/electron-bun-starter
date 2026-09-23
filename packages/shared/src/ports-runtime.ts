import crypto from "node:crypto";
import net from "node:net";

type NetServerLike = {
  unref: () => void;
  listen: (port: number, host: string, callback?: () => void) => void;
  close: (callback?: () => void) => void;
  address: () => unknown;
  on: (event: string, listener: (...args: any[]) => void) => void;
};

export function isPortAvailable(port: number, host = "127.0.0.1"): Promise<boolean> {
  return new Promise((resolve) => {
    const server = net.createServer() as unknown as NetServerLike;
    server.unref();
    const onError = () => resolve(false);
    const onListening = () => {
      server.close(() => resolve(true));
    };
    server.on("error", onError);
    server.on("listening", onListening);
    server.listen(port, host);
  });
}

export async function findAvailablePort(preferredPort: number, host = "127.0.0.1"): Promise<number> {
  if (preferredPort > 0 && (await isPortAvailable(preferredPort, host))) {
    return preferredPort;
  }

  return new Promise((resolve, reject) => {
    const server = net.createServer() as unknown as NetServerLike;
    server.unref();
    server.on("error", reject);
    server.on("listening", () => {
      const address = server.address();
      const port = typeof address === "object" && address && "port" in address ? Number((address as { port: number }).port) : 0;
      server.close(() => resolve(port));
    });
    server.listen(0, host);
  });
}

export function generateSessionToken(): string {
  return crypto.randomBytes(24).toString("hex");
}
