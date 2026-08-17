import assert from "node:assert/strict";
import test from "node:test";
import { GET as getAdminSession } from "../app/api/auth/admin-session/route.ts";
import { createAdminSessionToken, makeAdminSessionCookie } from "../worker/adminAuth.ts";
import { POST as googleLogin } from "../app/api/auth/google/route.ts";
import { GET as getMatches } from "../app/api/matches/route.ts";
import { POST as telegramAlert } from "../app/api/telegram-alert/route.ts";

const secret = "test-secret-with-at-least-thirty-two-characters";
const appOrigin = "https://navixa.example";

function post(path: string, body: unknown, headers: Record<string, string> = {}) {
  return new Request(`${appOrigin}${path}`, { method: "POST", headers: { origin: appOrigin, "content-type": "application/json", ...headers }, body: JSON.stringify(body) });
}

test("matches API rejects malformed dates and provides safe demo data without a provider key", async () => {
  const prior = process.env.API_FOOTBALL_KEY;
  delete process.env.API_FOOTBALL_KEY;
  try {
    const invalid = await getMatches(new Request(`${appOrigin}/api/matches?date=17-08-2026`));
    assert.equal(invalid.status, 400);
    const response = await getMatches(new Request(`${appOrigin}/api/matches?date=2026-08-17`));
    const payload = await response.json() as { source: string; matches: unknown[] };
    assert.equal(response.status, 200);
    assert.equal(payload.source, "demo");
    assert.equal(payload.matches.length, 2);
  } finally {
    if (prior === undefined) delete process.env.API_FOOTBALL_KEY;
    else process.env.API_FOOTBALL_KEY = prior;
  }
});

test("Google login refuses cross-origin session issuance", async () => {
  const response = await googleLogin(new Request(`${appOrigin}/api/auth/google`, { method: "POST", headers: { origin: "https://attacker.example", "content-type": "application/json" }, body: JSON.stringify({ credential: "untrusted" }) }));
  assert.equal(response.status, 403);
});

test("Google login issues a server-only cookie after an approved credential", async () => {
  const priorSecret = process.env.ADMIN_JWT_SECRET;
  const priorFetch = globalThis.fetch;
  process.env.ADMIN_JWT_SECRET = secret;
  globalThis.fetch = async () => new Response(JSON.stringify({ aud: "876266145464-i4pigjbevro3ki0d0lj0gds6geivecvb.apps.googleusercontent.com", email: "s2shug@gmail.com", email_verified: true, iss: "https://accounts.google.com" }), { status: 200, headers: { "content-type": "application/json" } });
  try {
    const response = await googleLogin(post("/api/auth/google", { credential: "approved-google-token" }));
    const payload = await response.json() as { ok?: boolean; email?: string };
    assert.equal(response.status, 200);
    assert.equal(payload.ok, true);
    assert.equal(payload.email, undefined);
    assert.match(response.headers.get("set-cookie") || "", /HttpOnly/);
    assert.match(response.headers.get("set-cookie") || "", /navixa_admin_session=/);
  } finally {
    globalThis.fetch = priorFetch;
    if (priorSecret === undefined) delete process.env.ADMIN_JWT_SECRET;
    else process.env.ADMIN_JWT_SECRET = priorSecret;
  }
});

test("admin-session API only reports authenticated when a valid signed cookie is present", async () => {
  const priorSecret = process.env.ADMIN_JWT_SECRET;
  process.env.ADMIN_JWT_SECRET = secret;
  try {
    const anonymous = await getAdminSession(new Request(`${appOrigin}/api/auth/admin-session`));
    assert.deepEqual(await anonymous.json(), { authenticated: false });
    const token = await createAdminSessionToken("s2shug@gmail.com", secret);
    const cookie = makeAdminSessionCookie(token).split(";")[0];
    const authenticated = await getAdminSession(new Request(`${appOrigin}/api/auth/admin-session`, { headers: { cookie } }));
    assert.deepEqual(await authenticated.json(), { authenticated: true });
  } finally {
    if (priorSecret === undefined) delete process.env.ADMIN_JWT_SECRET;
    else process.env.ADMIN_JWT_SECRET = priorSecret;
  }
});

test("Telegram API blocks cross-origin requests and temporarily limits a sixth request", async () => {
  const crossOrigin = await telegramAlert(new Request(`${appOrigin}/api/telegram-alert`, { method: "POST", headers: { origin: "https://attacker.example", "content-type": "application/json" }, body: JSON.stringify({}) }));
  assert.equal(crossOrigin.status, 403);
  for (let count = 0; count < 5; count++) {
    const response = await telegramAlert(post("/api/telegram-alert", {}, { "CF-Connecting-IP": "203.0.113.77" }));
    assert.equal(response.status, 400);
  }
  const limited = await telegramAlert(post("/api/telegram-alert", {}, { "CF-Connecting-IP": "203.0.113.77" }));
  assert.equal(limited.status, 429);
  assert.ok(Number(limited.headers.get("Retry-After")) >= 1);
});
