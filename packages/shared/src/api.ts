import { Effect, Schema } from "effect";
import { HealthResponse, WelcomeResponse } from "@electron-bun-starter/contracts";

const decodeJson = <A, I>(schema: Schema.Schema<A, I>, value: unknown) =>
  Schema.decodeUnknown(schema)(value).pipe(
    Effect.mapError((error) => new Error(`Invalid API response: ${String(error)}`)),
  );

export type ApiClientOptions = Readonly<{
  token?: string;
  fetch?: typeof globalThis.fetch;
}>;

function resolveEndpoint(path: string, baseUrl: string): string {
  if (!baseUrl) return path;
  return new URL(path, baseUrl.endsWith("/") ? baseUrl : `${baseUrl}/`).toString();
}

export const createApiClient = (baseUrl = "", options: ApiClientOptions = {}) => {
  const requestHeaders: Record<string, string> = {};
  if (options.token) {
    requestHeaders["x-app-token"] = options.token;
  }

  const customFetch = options.fetch ?? globalThis.fetch.bind(globalThis);

  const fetchEndpoint = (path: string) =>
    Effect.tryPromise({
      try: () => customFetch(resolveEndpoint(path, baseUrl), { headers: requestHeaders }),
      catch: (error) => new Error(`Request to ${path} failed: ${String(error)}`),
    });

  return {
    health: Effect.gen(function* () {
      const response = yield* fetchEndpoint("/api/health");
      if (!response.ok) {
        return yield* Effect.fail(new Error(`Health request failed with status ${response.status}`));
      }
      return yield* decodeJson(HealthResponse, yield* Effect.tryPromise({
        try: () => response.json(),
        catch: (error) => new Error(`Health response was not JSON: ${String(error)}`),
      }));
    }),
    welcome: Effect.gen(function* () {
      const response = yield* fetchEndpoint("/api/welcome");
      if (!response.ok) {
        return yield* Effect.fail(new Error(`Welcome request failed with status ${response.status}`));
      }
      return yield* decodeJson(WelcomeResponse, yield* Effect.tryPromise({
        try: () => response.json(),
        catch: (error) => new Error(`Welcome response was not JSON: ${String(error)}`),
      }));
    }),
  };
};

export type ApiClient = ReturnType<typeof createApiClient>;
