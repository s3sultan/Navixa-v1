/** Cloudflare Worker entry point for the vinext-starter template. */
import { handleImageOptimization, DEFAULT_DEVICE_SIZES, DEFAULT_IMAGE_SIZES } from "vinext/server/image-optimization";
import handler from "vinext/server/app-router-entry";
import { ADMIN_SESSION_COOKIE, createMemoryRateLimiter, isProtectedAdminApiPath, isProtectedAdminPath, isTrustedSameOriginRequest, readCookie, resolveAdminJwtSecret, verifyAdminSessionToken } from "./adminAuth";
import { deliverDueMatchPushes } from "./matchPush";

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

// Public-document cache is deliberately an allowlist. Never cache a request that
// could be personalized by a session, a Next.js RSC navigation, or a query string.
const PUBLIC_DOCUMENT_PATHS = new Set(["/", "/health", "/worship", "/plus", "/privacy"]);
const PUBLIC_DOCUMENT_TTL_SECONDS = 60;

function isPublicDocumentCacheable(request: Request, url: URL) {
  return request.method === "GET"
    && PUBLIC_DOCUMENT_PATHS.has(url.pathname)
    && url.search === ""
    && !request.headers.has("Cookie")
    && !request.headers.has("RSC")
    && !request.headers.has("Next-Router-Prefetch");
}

function publicDocumentCacheKey(url: URL) {
  const key = new URL(url.toString());
  key.search = "";
  return new Request(key.toString(), { method: "GET" });
}

function canStorePublicDocument(response: Response) {
  return response.status === 200
    && !response.headers.has("Set-Cookie")
    && (response.headers.get("content-type") || "").includes("text/html");
}

const publicMutationLimits: Record<string, number> = {
  "/api/telegram-alert": 5,
  "/api/stats": 20,
  "/api/sync": 12,
  "/api/auth/google": 10,
  "/api/auth/logout": 10,
  "/api/push/subscriptions": 8,
  "/api/match-events": 30,
  "/api/performance": 30,
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

type PerformanceSample = { path: "/" | "/health"; ttfb_ms: number; load_ms: number };
type PerformanceAlertState = { last_alert_at: string };
const PERFORMANCE_BUCKET_MINUTES = 5;
const PERFORMANCE_ALERT_P95_MS = 1_200;
const PERFORMANCE_ALERT_MIN_SAMPLES = 10;
const PERFORMANCE_ALERT_COOLDOWN_MS = 30 * 60 * 1000;

function utcFiveMinuteBucket(date: Date) {
  const bucket = new Date(date);
  bucket.setUTCSeconds(0, 0);
  bucket.setUTCMinutes(Math.floor(bucket.getUTCMinutes() / PERFORMANCE_BUCKET_MINUTES) * PERFORMANCE_BUCKET_MINUTES);
  return bucket;
}

async function aggregatePerformanceWindows(env: Env) {
  // The current bucket is still receiving beacons. Aggregate the last completed
  // five-minute window and retain only short-lived anonymous raw samples.
  const now = new Date();
  const bucket = utcFiveMinuteBucket(new Date(now.getTime() - PERFORMANCE_BUCKET_MINUTES * 60_000));
  const bucketStart = bucket.toISOString();
  const bucketEnd = new Date(bucket.getTime() + PERFORMANCE_BUCKET_MINUTES * 60_000).toISOString();
  const raw = await env.DB.prepare(
    "SELECT path, ttfb_ms, load_ms FROM navixa_performance_samples WHERE captured_at >= ? AND captured_at < ? ORDER BY path ASC, load_ms ASC",
  ).bind(bucketStart, bucketEnd).all<PerformanceSample>();

  const byPath = new Map<string, PerformanceSample[]>();
  for (const sample of raw.results) {
    const entries = byPath.get(sample.path) || [];
    entries.push(sample);
    byPath.set(sample.path, entries);
  }

  for (const [path, samples] of byPath) {
    if (samples.length === 0) continue;
    const count = samples.length;
    const averageTtfb = Math.round(samples.reduce((sum, sample) => sum + sample.ttfb_ms, 0) / count);
    const averageLoad = Math.round(samples.reduce((sum, sample) => sum + sample.load_ms, 0) / count);
    const p95Load = samples[Math.max(0, Math.ceil(count * 0.95) - 1)].load_ms;
    await env.DB.prepare(
      "INSERT INTO navixa_performance_windows (bucket_start,path,sample_count,avg_ttfb_ms,avg_load_ms,p95_load_ms,created_at) VALUES (?,?,?,?,?,?,?) ON CONFLICT(bucket_start,path) DO UPDATE SET sample_count=excluded.sample_count,avg_ttfb_ms=excluded.avg_ttfb_ms,avg_load_ms=excluded.avg_load_ms,p95_load_ms=excluded.p95_load_ms,created_at=excluded.created_at",
    ).bind(bucketStart, path, count, averageTtfb, averageLoad, p95Load, now.toISOString()).run();

    if (count < PERFORMANCE_ALERT_MIN_SAMPLES || p95Load <= PERFORMANCE_ALERT_P95_MS) continue;
    const state = await env.DB.prepare(
      "SELECT last_alert_at FROM navixa_performance_alert_state WHERE path = ?",
    ).bind(path).all<PerformanceAlertState>();
    const prior = state.results[0]?.last_alert_at ? Date.parse(state.results[0].last_alert_at) : 0;
    if (prior && now.getTime() - prior < PERFORMANCE_ALERT_COOLDOWN_MS) continue;

    await env.DB.prepare(
      "INSERT INTO navixa_performance_alert_state (path,last_alert_at,last_p95_load_ms,last_sample_count) VALUES (?,?,?,?) ON CONFLICT(path) DO UPDATE SET last_alert_at=excluded.last_alert_at,last_p95_load_ms=excluded.last_p95_load_ms,last_sample_count=excluded.last_sample_count",
    ).bind(path, now.toISOString(), p95Load, count).run();
    console.log(JSON.stringify({
      event: "performance_p95_alert",
      severity: "warning",
      path,
      bucket_start: bucketStart,
      p95_load_ms: p95Load,
      sample_count: count,
      threshold_ms: PERFORMANCE_ALERT_P95_MS,
    }));
  }

  // Short retention keeps the raw source anonymous and inexpensive. Aggregates
  // remain available for the operational dashboard and long-term comparisons.
  if (now.getUTCMinutes() % 15 === 0) {
    const rawCutoff = new Date(now.getTime() - 2 * 60 * 60_000).toISOString();
    const aggregateCutoff = new Date(now.getTime() - 30 * 24 * 60 * 60_000).toISOString();
    await env.DB.batch([
      env.DB.prepare("DELETE FROM navixa_performance_samples WHERE captured_at < ?").bind(rawCutoff),
      env.DB.prepare("DELETE FROM navixa_performance_windows WHERE bucket_start < ?").bind(aggregateCutoff),
    ]);
  }
}

const worker = {
  async scheduled(_controller: { cron: string }, env: Env, ctx: ExecutionContext) {
    ctx.waitUntil(deliverDueMatchPushes(env).then(result => console.log(JSON.stringify({ event: "match_push_scheduled", delivered: result.delivered, skipped: result.skipped }))));
    ctx.waitUntil(aggregatePerformanceWindows(env).catch(error => console.log(JSON.stringify({ event: "performance_aggregation_failed", message: error instanceof Error ? error.message : "unknown" }))));
  },
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

    const publicDocumentCacheable = isPublicDocumentCacheable(request, url);
    const cacheKey = publicDocumentCacheable ? publicDocumentCacheKey(url) : null;
    if (cacheKey) {
      const cached = await caches.default.match(cacheKey);
      if (cached) {
        const hit = new Response(cached.body, cached);
        hit.headers.set("Cache-Control", `public, max-age=0, s-maxage=${PUBLIC_DOCUMENT_TTL_SECONDS}`);
        hit.headers.set("X-NAVIXA-Edge-Cache", "HIT");
        return auditResponse(request, url, hit, startedAt, "public");
      }
    }

    const response = await handler.fetch(request, env, ctx);
    if (requiresAdminSession) response.headers.set("Cache-Control", "private, no-store");
    if (cacheKey && canStorePublicDocument(response)) {
      response.headers.set("Cache-Control", `public, max-age=0, s-maxage=${PUBLIC_DOCUMENT_TTL_SECONDS}`);
      response.headers.set("X-NAVIXA-Edge-Cache", "MISS");
      ctx.waitUntil(caches.default.put(cacheKey, response.clone()));
    }
    return auditResponse(request, url, response, startedAt, requiresAdminSession ? "admin" : "public");
  },
};

export default worker;
