/** Cloudflare Worker entry point for the vinext-starter template. */
import { handleImageOptimization, DEFAULT_DEVICE_SIZES, DEFAULT_IMAGE_SIZES } from "vinext/server/image-optimization";
import handler from "vinext/server/app-router-entry";
import { ADMIN_SESSION_COOKIE, createMemoryRateLimiter, isProtectedAdminApiPath, isProtectedAdminPath, isTrustedSameOriginRequest, readCookie, resolveAdminJwtSecret, verifyAdminSessionToken } from "./adminAuth";

interface Env {
  ASSETS: Fetcher;
  DB: D1Database;
  IMAGES: {
    input(stream: ReadableStream): {
      transform(options: Record<string, unknown>): {
        output(options: { format: string; quality: number }): Promise<{ response(): Response }>;
      };
    };
  };
}

interface ExecutionContext {
  waitUntil(promise: Promise<unknown>): void;
  passThroughOnException(): void;
}

// Image security config. SVG sources with .svg extension auto-skip the
// optimization endpoint on the client side (served directly, no proxy).
// To route SVGs through the optimizer (with security headers), set
// dangerouslyAllowSVG: true in next.config.js and uncomment below:
// const imageConfig: ImageConfig = { dangerouslyAllowSVG: true };

const publicMutationLimiter = createMemoryRateLimiter();
const publicMutationLimits: Record<string, number> = {
  "/api/telegram-alert": 5,
  "/api/stats": 20,
  "/api/sync": 12,
  "/api/auth/google": 10,
  "/api/auth/logout": 10,
};

function publicMutationGuard(request: Request, url: URL) {
  if (!Object.hasOwn(publicMutationLimits, url.pathname) || !["POST", "PUT", "PATCH", "DELETE"].includes(request.method)) return null;
  if (!isTrustedSameOriginRequest(request)) {
    return new Response(JSON.stringify({ error: "مصدر الطلب غير موثوق" }), { status: 403, headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" } });
  }
  const clientIp = request.headers.get("CF-Connecting-IP") || request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
  const limit = publicMutationLimits[url.pathname];
  const result = publicMutationLimiter.consume(`${url.pathname}:${clientIp}`, limit, 60_000);
  if (!result.allowed) {
    return new Response(JSON.stringify({ error: "تجاوزت الحد المؤقت للطلبات" }), { status: 429, headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store", "retry-after": String(result.retryAfterSeconds) } });
  }
  return null;
}

function auditResponse(request: Request, url: URL, response: Response, startedAt: number, scope: "public" | "admin" | "mutation") {
  const status = response.status;
  const securityEvent = status === 401 || status === 403 || status === 429 || status >= 500 || scope !== "public";
  if (securityEvent || Math.random() < 0.1) {
    console.log(JSON.stringify({
      event: "request",
      request_id: crypto.randomUUID(),
      cf_ray: request.headers.get("CF-Ray") || null,
      method: request.method,
      path: url.pathname,
      status,
      duration_ms: Date.now() - startedAt,
      auth: scope === "admin" ? (status < 400 ? "accepted" : "rejected") : scope,
    }));
  }
  return response;
}

const worker = {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const url = new URL(request.url);
    const startedAt = Date.now();

    const mutationRejection = publicMutationGuard(request, url);
    if (mutationRejection) return auditResponse(request, url, mutationRejection, startedAt, "mutation");

    const requiresAdminSession = isProtectedAdminPath(url.pathname) || isProtectedAdminApiPath(url.pathname);
    if (requiresAdminSession) {
      const secret = await resolveAdminJwtSecret();
      const session = secret ? await verifyAdminSessionToken(readCookie(request, ADMIN_SESSION_COOKIE), secret) : null;
      if (!session) {
        if (isProtectedAdminApiPath(url.pathname)) {
          return auditResponse(request, url, new Response(JSON.stringify({ error: "يلزم تسجيل دخول إداري صالح" }), { status: 401, headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" } }), startedAt, "admin");
        }
        const loginUrl = new URL("/admin/login?reason=session", request.url);
        return auditResponse(request, url, Response.redirect(loginUrl.toString(), 302), startedAt, "admin");
      }
    }

    if (url.pathname === "/_vinext/image") {
      const allowedWidths = [...DEFAULT_DEVICE_SIZES, ...DEFAULT_IMAGE_SIZES];
      return handleImageOptimization(request, {
        fetchAsset: (path) => env.ASSETS.fetch(new Request(new URL(path, request.url))),
        transformImage: async (body, { width, format, quality }) => {
          const result = await env.IMAGES.input(body).transform(width > 0 ? { width } : {}).output({ format, quality });
          return result.response();
        },
      }, allowedWidths);
    }

    const response = await handler.fetch(request, env, ctx);
    if (requiresAdminSession) response.headers.set("Cache-Control", "private, no-store");
    if (url.pathname === "/" && request.method === "GET" && !request.headers.has("RSC") && !request.headers.has("Next-Router-Prefetch")) {
      response.headers.set("Cache-Control", "public, max-age=0, s-maxage=30, stale-while-revalidate=120");
    }
    return auditResponse(request, url, response, startedAt, requiresAdminSession ? "admin" : "public");
  },
};

export default worker;
