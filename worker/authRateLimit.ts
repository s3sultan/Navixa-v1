import { hashOpaqueValue, type D1Database } from "./userAuth.ts";

type D1Statement = {
  bind: (...values: unknown[]) => D1Statement;
  all: <T = Record<string, unknown>>() => Promise<{ results: T[] }>;
  run: () => Promise<unknown>;
};

type RateLimitDatabase = D1Database & { prepare: (sql: string) => D1Statement };

export function clientIp(request: Request) {
  return request.headers.get("cf-connecting-ip")?.trim()
    || request.headers.get("x-forwarded-for")?.split(",")[0]?.trim()
    || "anonymous";
}

export async function consumeAuthRateLimit(
  database: RateLimitDatabase,
  scope: string,
  subject: string,
  pepper: string,
  limit: number,
  windowMs: number,
) {
  const now = Date.now();
  const windowStart = Math.floor(now / windowMs) * windowMs;
  const expiresAt = new Date(windowStart + windowMs).toISOString();
  const bucketHash = await hashOpaqueValue(`auth-rate-v1:${scope}:${subject}:${windowStart}:${pepper}`);

  await database.prepare(
    "INSERT INTO navixa_auth_rate_limits(bucket_hash,attempts,expires_at) VALUES (?,1,?) ON CONFLICT(bucket_hash) DO UPDATE SET attempts=attempts+1,expires_at=excluded.expires_at",
  ).bind(bucketHash, expiresAt).run();

  const rows = await database.prepare(
    "SELECT attempts FROM navixa_auth_rate_limits WHERE bucket_hash=? LIMIT 1",
  ).bind(bucketHash).all<{ attempts: number }>();
  const attempts = Number(rows.results[0]?.attempts || 0);

  // Keep cleanup inexpensive and non-blocking; the primary key prevents unbounded duplicates per window.
  if (crypto.getRandomValues(new Uint8Array(1))[0] < 8) {
    database.prepare("DELETE FROM navixa_auth_rate_limits WHERE expires_at<?").bind(new Date(now - 86_400_000).toISOString()).run().catch(() => {});
  }

  return {
    allowed: attempts <= limit,
    attempts,
    retryAfterSeconds: Math.max(1, Math.ceil((windowStart + windowMs - now) / 1000)),
  };
}
