import { useEffect, useState } from "react";
import { Effect } from "effect";
import { createApiClient, resolveApiConfig } from "@electron-bun-starter/shared";

type ServerApiBridge = Readonly<{
  getHealth: () => Promise<unknown>;
  getWelcome: () => Promise<unknown>;
}>;

declare global {
  interface Window {
    serverApi?: ServerApiBridge;
  }
}

function createBridgeFetch(bridge: ServerApiBridge): typeof fetch {
  return async (input) => {
    const inputUrl = input instanceof Request ? input.url : input.toString();
    const pathname = new URL(inputUrl, "http://electron-bun-starter.local").pathname;
    const readEndpoint = pathname === "/api/health"
      ? bridge.getHealth
      : pathname === "/api/welcome"
        ? bridge.getWelcome
        : undefined;

    if (!readEndpoint) return new Response("Not Found", { status: 404 });

    const data = await readEndpoint();
    return new Response(JSON.stringify(data), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  };
}

export function getApiClient() {
  const config = resolveApiConfig();
  const bridge = typeof window === "undefined" ? undefined : window.serverApi;
  return createApiClient(config.apiUrl, bridge ? { fetch: createBridgeFetch(bridge) } : {});
}

export type HealthData = Effect.Effect.Success<ReturnType<typeof getApiClient>["health"]>;

export type ServerStatus = Readonly<{
  isChecking: boolean;
  isConnected: boolean;
  data: HealthData | null;
  error: string | null;
}>;

export function useServerStatus(): ServerStatus {
  const [status, setStatus] = useState<ServerStatus>({
    isChecking: true,
    isConnected: false,
    data: null,
    error: null,
  });

  useEffect(() => {
    let cancelled = false;
    const client = getApiClient();

    Effect.runPromise(client.health)
      .then((data) => {
        if (!cancelled) {
          setStatus({
            isChecking: false,
            isConnected: true,
            data,
            error: null,
          });
        }
      })
      .catch((err: unknown) => {
        if (!cancelled) {
          setStatus({
            isChecking: false,
            isConnected: false,
            data: null,
            error: err instanceof Error ? err.message : String(err),
          });
        }
      });

    return () => {
      cancelled = true;
    };
  }, []);

  return status;
}
