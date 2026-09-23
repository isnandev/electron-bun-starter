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
}>;

export function resolveApiConfig(): AppConfig {
  return {
    apiUrl: "",
    apiPort: DEFAULT_SERVER_PORT,
  };
}
