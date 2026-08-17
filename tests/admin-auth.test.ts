import assert from "node:assert/strict";
import test from "node:test";
import {
  ADMIN_SESSION_COOKIE,
  createAdminSessionToken,
  createMemoryRateLimiter,
  isProtectedAdminApiPath,
  isProtectedAdminPath,
  isTrustedSameOriginRequest,
  makeAdminSessionCookie,
  readCookie,
  verifyAdminSessionToken,
} from "../worker/adminAuth.ts";

const secret = "test-secret-with-at-least-thirty-two-characters";

test("creates and verifies a signed JWT administration session", async () => {
  const now = Date.UTC(2026, 7, 17, 12, 0, 0);
  const token = await createAdminSessionToken("S2SHUG@GMAIL.COM", secret, now);
  const session = await verifyAdminSessionToken(token, secret, now + 1_000);
  assert.deepEqual(session?.email, "s2shug@gmail.com");
  assert.equal(session?.aud, "navixa-admin");
});

test("rejects tampered and expired JWT administration sessions", async () => {
  const now = Date.UTC(2026, 7, 17, 12, 0, 0);
  const token = await createAdminSessionToken("s2shug@gmail.com", secret, now);
  const [header, claims, signature] = token.split(".");
  assert.equal(await verifyAdminSessionToken(`${header}.${claims}.${signature.slice(0, -1)}x`, secret, now + 1_000), null);
  assert.equal(await verifyAdminSessionToken(token, secret, now + 9 * 60 * 60 * 1_000), null);
});

test("uses an HttpOnly secure cookie and reads it without trusting client storage", async () => {
  const token = await createAdminSessionToken("s2shug@gmail.com", secret);
  const cookie = makeAdminSessionCookie(token);
  assert.match(cookie, /HttpOnly/);
  assert.match(cookie, /Secure/);
  assert.match(cookie, /SameSite=Strict/);
  assert.equal(readCookie(new Request("https://navixa.example/admin", { headers: { cookie: `theme=dark; ${cookie.split(";")[0]}` } }), ADMIN_SESSION_COOKIE), token);
});

test("protects all administration page and API prefixes except login", () => {
  assert.equal(isProtectedAdminPath("/admin"), true);
  assert.equal(isProtectedAdminPath("/admin/emergency"), true);
  assert.equal(isProtectedAdminPath("/admin/login"), false);
  assert.equal(isProtectedAdminApiPath("/api/admin"), true);
  assert.equal(isProtectedAdminApiPath("/api/admin/settings"), true);
  assert.equal(isProtectedAdminApiPath("/api/stats"), false);
});

test("accepts only same-origin mutations", () => {
  assert.equal(isTrustedSameOriginRequest(new Request("https://navixa.example/api/stats", { headers: { origin: "https://navixa.example" } })), true);
  assert.equal(isTrustedSameOriginRequest(new Request("https://navixa.example/api/stats", { headers: { origin: "https://attacker.example" } })), false);
});

test("enforces a fixed request window for sensitive public mutations", () => {
  let now = 0;
  const limiter = createMemoryRateLimiter(() => now);
  for (let count = 0; count < 5; count++) assert.equal(limiter.consume("telegram:203.0.113.7", 5, 60_000).allowed, true);
  const rejected = limiter.consume("telegram:203.0.113.7", 5, 60_000);
  assert.equal(rejected.allowed, false);
  assert.equal(rejected.retryAfterSeconds, 60);
  now = 60_000;
  assert.equal(limiter.consume("telegram:203.0.113.7", 5, 60_000).allowed, true);
});
