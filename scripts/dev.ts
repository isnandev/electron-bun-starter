import { resolvePorts, serverUrl, webUrl } from "../packages/shared/src/ports";
import { findAvailablePort, generateSessionToken } from "../packages/shared/src/ports-runtime";

const projectRoot = import.meta.dir.replace(/\\scripts$/, "");
const preferredPorts = resolvePorts(process.env);
const serverPort = await findAvailablePort(preferredPorts.serverPort);
const webPort = await findAvailablePort(preferredPorts.webPort);
const sessionToken = process.env.APP_AUTH_TOKEN ?? generateSessionToken();

const environment = {
  ...process.env,
  SERVER_PORT: String(serverPort),
  PORT: String(serverPort),
  WEB_PORT: String(webPort),
  VITE_SERVER_PORT: String(serverPort),
  VITE_API_URL: serverUrl(serverPort),
  APP_AUTH_TOKEN: sessionToken,
  VITE_APP_AUTH_TOKEN: sessionToken,
};

console.log(`Starting web on ${webUrl(webPort)} and Bun on ${serverUrl(serverPort)}`);

const web = Bun.spawn(["bun", "run", "--cwd", "apps/web", "dev"], {
  cwd: projectRoot,
  env: environment,
  stdin: "inherit",
  stdout: "inherit",
  stderr: "inherit",
});

async function waitForWebServer(): Promise<void> {
  const url = webUrl(webPort);
  for (let attempt = 0; attempt < 80; attempt += 1) {
    try {
      const response = await fetch(url);
      if (response.ok) return;
    } catch {
      // Vite is still starting.
    }
    await Bun.sleep(250);
  }
  throw new Error(`Vite did not become ready on ${url}`);
}

let electron: ReturnType<typeof Bun.spawn> | undefined;
try {
  await waitForWebServer();
  electron = Bun.spawn(["bun", "run", "--cwd", "apps/electron", "dev"], {
    cwd: projectRoot,
    env: {
      ...environment,
      ELECTRON_RENDERER_URL: webUrl(webPort),
    },
    stdin: "inherit",
    stdout: "inherit",
    stderr: "inherit",
  });

  const stop = () => {
    web.kill();
    electron?.kill();
  };
  process.on("SIGINT", stop);
  process.on("SIGTERM", stop);

  const exitCode = await electron.exited;
  web.kill();
  process.exit(exitCode);
} catch (error) {
  web.kill();
  electron?.kill();
  console.error(error);
  process.exit(1);
}
