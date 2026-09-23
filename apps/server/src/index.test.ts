import { describe, expect, it } from "bun:test";
import { handleRequest } from "./index";

describe("server", () => {
  it("reports the Bun runtime when authorized or token disabled", async () => {
    const response = handleRequest(new Request("http://localhost/api/health"));
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ status: "ok", runtime: "bun", transport: "http" });
  });

  it("returns welcome response", async () => {
    const response = handleRequest(new Request("http://localhost/api/welcome"));
    expect(response.status).toBe(200);
    const body = (await response.json()) as { title: string; capabilities: string[] };
    expect(body.title).toBe("electron-bun-starter");
    expect(body.capabilities).toContain("effect");
  });

  it("handles OPTIONS preflight without requiring token", async () => {
    const response = handleRequest(new Request("http://127.0.0.1/api/health", {
      method: "OPTIONS",
      headers: {
        origin: "http://127.0.0.1:5174",
        "access-control-request-method": "GET",
        "access-control-request-headers": "x-app-token",
      },
    }), "secret");
    expect(response.status).toBe(204);
    expect(response.headers.get("Access-Control-Allow-Methods")).toBe("GET");
  });

  it("rejects unauthorized requests when token is configured", async () => {
    const response = handleRequest(new Request("http://localhost/api/health"), "secret-123");
    expect(response.status).toBe(401);
  });

  it("accepts requests with valid x-app-token header", async () => {
    const response = handleRequest(
      new Request("http://localhost/api/health", {
        headers: { "x-app-token": "secret-123" },
      }),
      "secret-123"
    );
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ status: "ok", runtime: "bun", transport: "http" });
  });

  it("accepts requests with valid Bearer authorization header", async () => {
    const response = handleRequest(
      new Request("http://localhost/api/health", {
        headers: { authorization: "Bearer secret-123" },
      }),
      "secret-123"
    );
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ status: "ok", runtime: "bun", transport: "http" });
  });

  it("applies host isolation to CORS origins", async () => {
    const allowedLocal = handleRequest(
      new Request("http://localhost/api/health", {
        headers: { origin: "http://127.0.0.1:5174" },
      })
    );
    expect(allowedLocal.headers.get("Access-Control-Allow-Origin")).toBe("http://127.0.0.1:5174");

    const foreignOrigin = handleRequest(
      new Request("http://localhost/api/health", {
        headers: { origin: "https://malicious-site.com" },
      })
    );
    expect(foreignOrigin.headers.get("Access-Control-Allow-Origin")).toBeNull();
  });
});
