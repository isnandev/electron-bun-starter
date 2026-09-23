import { Schema } from "effect";
import { HealthResponse, WelcomeResponse } from "@electron-bun-starter/contracts";
import { resolvePorts } from "@electron-bun-starter/shared";

const port = resolvePorts(Bun.env).serverPort;

export function isAuthorized(request: Request, expectedToken = Bun.env.APP_AUTH_TOKEN): boolean {
  if (!expectedToken) return true;
  const tokenHeader = request.headers.get("x-app-token");
  if (tokenHeader === expectedToken) return true;
  const authHeader = request.headers.get("authorization");
  if (authHeader && authHeader.replace(/^Bearer\s+/i, "") === expectedToken) return true;
  return false;
}

export function withCors(response: Response, request: Request): Response {
  const headers = new Headers(response.headers);
  const origin = request.headers.get("origin");

  // Host isolation: allow local origins or "null" (file:// in Electron)
  const isAllowedOrigin =
    !origin ||
    origin === "null" ||
    /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin);

  if (origin && isAllowedOrigin) {
    headers.set("Access-Control-Allow-Origin", origin);
    headers.set("Vary", "Origin");
  } else if (!origin) {
    headers.set("Access-Control-Allow-Origin", "*");
  }

  if (request.method === "OPTIONS") {
    headers.set("Access-Control-Allow-Methods", "GET,HEAD,PUT,POST,DELETE,PATCH");
    const requestedHeaders = request.headers.get("Access-Control-Request-Headers");
    headers.set(
      "Access-Control-Allow-Headers",
      requestedHeaders ?? "Content-Type, Authorization, x-app-token, X-Electron-Bun-Port"
    );
  }

  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}

export function handleRequest(request: Request, overrideToken?: string): Response {
  const { pathname } = new URL(request.url);

  if (request.method === "OPTIONS") {
    return withCors(new Response(null, { status: 204 }), request);
  }

  if (!isAuthorized(request, overrideToken)) {
    return withCors(
      Response.json({ error: "Unauthorized: invalid or missing session token" }, { status: 401 }),
      request
    );
  }

  let response: Response;

  if (request.method === "GET" && pathname === "/api/health") {
    response = Response.json(Schema.encodeSync(HealthResponse)(new HealthResponse({
      status: "ok",
      runtime: "bun",
      transport: "http",
    })));
  } else if (request.method === "GET" && pathname === "/api/welcome") {
    response = Response.json(Schema.encodeSync(WelcomeResponse)(new WelcomeResponse({
      title: "electron-bun-starter",
      message: "The shared page is connected to Bun.",
      capabilities: ["web", "electron", "effect", "shadcn"],
    })));
  } else {
    response = new Response("Not Found", { status: 404 });
  }

  return withCors(response, request);
}

if (import.meta.main) {
  try {
    const server = Bun.serve({ port, fetch: (req) => handleRequest(req) });
    console.log(`Bun server listening on http://127.0.0.1:${server.port}`);
  } catch (error: unknown) {
    const err = error as { code?: string };
    if (err?.code === "EADDRINUSE" && port !== 0) {
      console.warn(`Port ${port} in use, allocating ephemeral port...`);
      const server = Bun.serve({ port: 0, fetch: (req) => handleRequest(req) });
      console.log(`Bun server listening on http://127.0.0.1:${server.port}`);
    } else {
      throw error;
    }
  }
}
