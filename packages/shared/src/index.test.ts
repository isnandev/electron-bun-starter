import { describe, expect, it } from "bun:test";
import { Effect } from "effect";
import { createApiClient, parsePort, resolvePorts, resolveApiConfig } from "./index";
import { findAvailablePort, generateSessionToken } from "./ports-runtime";

describe("shared/ports", () => {
  it("parses ports correctly with fallbacks", () => {
    expect(parsePort("8080", 3000, "PORT")).toBe(8080);
    expect(parsePort(undefined, 3000, "PORT")).toBe(3000);
    expect(() => parsePort("invalid", 3000, "PORT")).toThrow();
  });

  it("resolves ports from environment", () => {
    const ports = resolvePorts({ SERVER_PORT: "9000", WEB_PORT: "6000" });
    expect(ports.serverPort).toBe(9000);
    expect(ports.webPort).toBe(6000);
  });

  it("resolves api config fallback", () => {
    const config = resolveApiConfig();
    expect(config.apiPort).toBeDefined();
    expect(typeof config.apiUrl).toBe("string");
  });
});

describe("shared/ports-runtime", () => {
  it("generates a session token", () => {
    const token = generateSessionToken();
    expect(token).toBeDefined();
    expect(token.length).toBe(48);
  });

  it("finds an available port", async () => {
    const port = await findAvailablePort(0);
    expect(port).toBeGreaterThan(0);
  });
});

describe("shared/api", () => {
  it("creates an api client and attaches headers", async () => {
    let capturedHeaders: Record<string, string> = {};
    const mockFetch = async (_url: string | URL | Request, init?: RequestInit) => {
      capturedHeaders = (init?.headers as Record<string, string>) ?? {};
      return new Response(JSON.stringify({ status: "ok", runtime: "bun", transport: "http" }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    };

    const client = createApiClient("http://127.0.0.1:8788", {
      token: "secret-token",
      fetch: mockFetch as unknown as typeof globalThis.fetch,
    });

    const result = await Effect.runPromise(client.health);
    expect(result.status).toBe("ok");
    expect(capturedHeaders["x-app-token"]).toBe("secret-token");
  });
});
