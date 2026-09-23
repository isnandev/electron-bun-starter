import { Schema } from "effect";
import { HealthResponse, WelcomeResponse } from "@electron-bun-starter/contracts";
import { resolvePorts } from "@electron-bun-starter/shared";

const { serverPort: port, webPort } = resolvePorts(Bun.env);
const allowedWebOrigin = `http://127.0.0.1:${webPort}`;
const corsPaths = new Set(["/api/health", "/api/welcome"]);
const corsHeaders = new Set(["authorization", "x-app-token"]);

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
  const pathname = new URL(request.url).pathname;
  const isCorsRoute = corsPaths.has(pathname) && ["GET", "OPTIONS"].includes(request.method);

  // CORS is for the configured local web client. Electron uses the preload IPC bridge.
  if (origin) headers.set("Vary", "Origin");
  if (origin === allowedWebOrigin && isCorsRoute) {
    headers.set("Access-Control-Allow-Origin", origin);
  }

  if (request.method === "OPTIONS") {
    // Browsers omit credentials on preflight. Keep this unauthenticated response narrow;
    // the actual API request still requires the session token.
    headers.set("Access-Control-Allow-Methods", "GET");
    headers.set("Access-Control-Allow-Headers", "Authorization, X-App-Token");
    headers.set("Access-Control-Max-Age", "600");
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
    const requestedMethod = request.headers.get("Access-Control-Request-Method")?.toUpperCase();
    const requestedHeaders = (request.headers.get("Access-Control-Request-Headers") ?? "")
      .split(",")
      .map((header) => header.trim().toLowerCase())
      .filter(Boolean);
    const validPreflight =
      request.headers.get("origin") === allowedWebOrigin &&
      corsPaths.has(pathname) &&
      requestedMethod === "GET" &&
      requestedHeaders.every((header) => corsHeaders.has(header));

    if (!validPreflight) return new Response(null, { status: 403 });
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
  let server: ReturnType<typeof Bun.serve>;
  const fetchRequest = (request: Request): Response => {
    const { pathname } = new URL(request.url);
    if (request.method === "POST" && pathname === "/_internal/shutdown") {
      const shutdownToken = Bun.env.APP_AUTH_TOKEN;
      if (!shutdownToken || request.headers.get("x-app-token") !== shutdownToken) {
        return new Response(null, { status: 401 });
      }

      setTimeout(() => {
        server.stop();
        setTimeout(() => process.exit(0), 100);
      }, 0);
      return new Response(null, { status: 202 });
    }

    return handleRequest(request);
  };

  try {
    server = Bun.serve({ hostname: "127.0.0.1", port, fetch: fetchRequest });
  } catch (error: unknown) {
    const err = error as { code?: string };
    if (err?.code === "EADDRINUSE" && port !== 0) {
      console.warn(`Port ${port} in use, allocating ephemeral port...`);
      server = Bun.serve({ hostname: "127.0.0.1", port: 0, fetch: fetchRequest });
    } else {
      throw error;
    }
  }
  console.log(`ELECTRON_BUN_SERVER_READY=${server.port}`);
  console.log(`Bun server listening on http://127.0.0.1:${server.port}`);
}
