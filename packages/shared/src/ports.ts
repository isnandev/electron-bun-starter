export const DEFAULT_SERVER_PORT = 8788;
export const DEFAULT_WEB_PORT = 5174;

export type PortEnvironment = Readonly<Record<string, string | undefined>>;

export type AppPorts = Readonly<{
  serverPort: number;
  webPort: number;
}>;

export function parsePort(value: string | undefined, fallback: number, name: string): number {
  if (!value) return fallback;

  const port = Number(value);
  if (!Number.isInteger(port) || port < 1 || port > 65_535) {
    throw new Error(`${name} must be an integer between 1 and 65535, received ${JSON.stringify(value)}`);
  }
  return port;
}

export function resolvePorts(environment: PortEnvironment): AppPorts {
  return {
    serverPort: parsePort(environment.SERVER_PORT ?? environment.PORT, DEFAULT_SERVER_PORT, "SERVER_PORT"),
    webPort: parsePort(environment.WEB_PORT, DEFAULT_WEB_PORT, "WEB_PORT"),
  };
}

export function serverUrl(port: number): string {
  return `http://127.0.0.1:${port}`;
}

export function webUrl(port: number): string {
  return `http://127.0.0.1:${port}`;
}

export type AppConfig = Readonly<{
  apiUrl: string;
  apiPort: number;
  apiToken: string;
}>;

export function resolveApiConfig(): AppConfig {
  const globalScope = globalThis as unknown as {
    appConfig?: AppConfig;
    process?: { env?: Record<string, string | undefined> };
  };

  if (globalScope.appConfig) {
    return globalScope.appConfig;
  }

  const env = globalScope.process?.env;
  const importMeta = import.meta as unknown as { env?: Record<string, string | undefined> };
  const importMetaEnv = importMeta.env;

  const port = parsePort(
    importMetaEnv?.VITE_SERVER_PORT ?? env?.SERVER_PORT ?? env?.PORT,
    DEFAULT_SERVER_PORT,
    "SERVER_PORT",
  );

  const url = importMetaEnv?.VITE_API_URL ?? env?.VITE_API_URL ?? "";
  const token = importMetaEnv?.VITE_APP_AUTH_TOKEN ?? env?.APP_AUTH_TOKEN ?? "";

  return {
    apiUrl: url,
    apiPort: port,
    apiToken: token,
  };
}

