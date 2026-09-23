import { useEffect, useState } from "react";
import { Effect } from "effect";
import { createApiClient, resolveApiConfig } from "@electron-bun-starter/shared";

export function getApiClient() {
  const config = resolveApiConfig();
  return createApiClient(config.apiUrl, { token: config.apiToken });
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
