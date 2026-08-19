import assert from "node:assert/strict";
import test from "node:test";
import { GET as getAdminSession } from "../app/api/auth/admin-session/route.ts";
import { createAdminSessionToken, makeAdminSessionCookie } from "../worker/adminAuth.ts";
import { POST as googleLogin } from "../app/api/auth/google/route.ts";
import { GET as getMatches } from "../app/api/matches/route.ts";
import { POST as telegramAlert } from "../app/api/telegram-alert/route.ts";
import { GET as getAdminMatches, POST as saveAdminMatch } from "../app/api/admin/matches/route.ts";
import { GET as getPushConfig } from "../app/api/push/config/route.ts";
import { POST as savePushSubscription } from "../app/api/push/subscriptions/route.ts";
import { POST as sendPushTest } from "../app/api/push/test/route.ts";
import { POST as trackMatchEvent } from "../app/api/match-events/route.ts";
import { GET as getMatchAnalytics } from "../app/api/admin/match-analytics/route.ts";
import { GET as getAdminManualMatches, POST as saveAdminManualMatch } from "../app/api/admin/manual-matches/route.ts";

const secret = "test-secret-with-at-least-thirty-two-characters";
const appOrigin = "https://navixa.example";

function post(path: string, body: unknown, headers: Record<string, string> = {}) {
  return new Request(`${appOrigin}${path}`, { method: "POST", headers: { origin: appOrigin, "content-type": "application/json", ...headers }, body: JSON.stringify(body) });
}

test("matches API rejects malformed dates and returns no unverified fixtures without a provider key", async () => {
  const prior = process.env.API_FOOTBALL_KEY;
  delete process.env.API_FOOTBALL_KEY;
  try {
    const invalid = await getMatches(new Request(`${appOrigin}/api/matches?date=17-08-2026`));
    assert.equal(invalid.status, 400);
    const response = await getMatches(new Request(`${appOrigin}/api/matches?date=2026-08-17`));
    const payload = await response.json() as { source: string; matches: unknown[] };
    assert.equal(response.status, 200);
    assert.equal(payload.source, "unavailable");
    assert.equal(payload.matches.length, 0);
  } finally {
    if (prior === undefined) delete process.env.API_FOOTBALL_KEY;
    else process.env.API_FOOTBALL_KEY = prior;
  }
});

test("matches API keeps Saudi Roshn fixtures and team logos while excluding Persian Gulf Pro League", async () => {
  const prior = process.env.API_FOOTBALL_KEY;
  const priorFetch = globalThis.fetch;
  process.env.API_FOOTBALL_KEY = "test-football-key";
  globalThis.fetch = async () => new Response(JSON.stringify({response:[
    {fixture:{id:1,date:"2026-08-18T18:00:00+03:00",status:{short:"NS"},venue:{name:"الملعب"}},league:{id:307,name:"Saudi Pro League",country:"Saudi Arabia"},teams:{home:{name:"الهلال",logo:"https://logos.example/hilal.png"},away:{name:"النصر",logo:"https://logos.example/nassr.png"}},goals:{home:null,away:null}},
    {fixture:{id:2,date:"2026-08-18T18:00:00+03:00",status:{short:"NS"},venue:{name:""}},league:{id:294,name:"Persian Gulf Pro League",country:"Iran"},teams:{home:{name:"فريق إيراني",logo:""},away:{name:"فريق آخر",logo:""}},goals:{home:null,away:null}}
  ]}),{status:200,headers:{"content-type":"application/json"}});
  try {
    const response = await getMatches(new Request(`${appOrigin}/api/matches?date=2026-08-18`));
    const payload = await response.json() as { source: string; matches: Array<{competitionId:string;home:string;away:string;homeLogo:string;awayLogo:string}> };
    assert.equal(payload.source,"api-football");
    assert.equal(payload.matches.length,1);
    assert.equal(payload.matches[0].competitionId,"rsl");
    assert.equal(payload.matches[0].home,"الهلال");
    assert.equal(payload.matches[0].away,"النصر");
    assert.equal(payload.matches[0].homeLogo,"https://logos.example/hilal.png");
    assert.equal(payload.matches[0].awayLogo,"https://logos.example/nassr.png");
  } finally {
    globalThis.fetch = priorFetch;
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

test("match administration API rejects anonymous and cross-origin mutation requests", async () => {
  const anonymous = await getAdminMatches(new Request(`${appOrigin}/api/admin/matches`));
  assert.equal(anonymous.status, 401);
  const crossOrigin = await saveAdminMatch(new Request(`${appOrigin}/api/admin/matches`, { method: "POST", headers: { origin: "https://attacker.example", "content-type": "application/json" }, body: JSON.stringify({ matchId: "1" }) }));
  assert.equal(crossOrigin.status, 401);
});

test("shared manual matches stay restricted to an authenticated administrator", async () => {
  const listing = await getAdminManualMatches(new Request(`${appOrigin}/api/admin/manual-matches`));
  assert.equal(listing.status, 401);
  const mutation = await saveAdminManualMatch(new Request(`${appOrigin}/api/admin/manual-matches`, { method: "POST", headers: { origin: "https://attacker.example", "content-type": "application/json" }, body: JSON.stringify({}) }));
  assert.equal(mutation.status, 401);
});

test("Push configuration never exposes a private key and Push mutations reject cross-origin calls", async () => {
  const publicBefore = process.env.VAPID_PUBLIC_KEY;
  const privateBefore = process.env.VAPID_PRIVATE_KEY;
  delete process.env.VAPID_PUBLIC_KEY;
  delete process.env.VAPID_PRIVATE_KEY;
  try {
    const unavailable = await getPushConfig();
    assert.equal(unavailable.status, 503);
    const crossOrigin = await savePushSubscription(new Request(`${appOrigin}/api/push/subscriptions`, { method: "POST", headers: { origin: "https://attacker.example", "content-type": "application/json" }, body: JSON.stringify({}) }));
    assert.equal(crossOrigin.status, 403);
    const pushTest = await sendPushTest(new Request(`${appOrigin}/api/push/test`, { method: "POST", headers: { origin: "https://attacker.example", "content-type": "application/json" }, body: JSON.stringify({ endpoint: "https://push.example/device" }) }));
    assert.equal(pushTest.status, 403);
    const event = await trackMatchEvent(new Request(`${appOrigin}/api/match-events`, { method: "POST", headers: { origin: "https://attacker.example", "content-type": "application/json" }, body: JSON.stringify({ event: "ribbon_view" }) }));
    assert.equal(event.status, 403);
    const analytics = await getMatchAnalytics(new Request(`${appOrigin}/api/admin/match-analytics`));
    assert.equal(analytics.status, 401);
  } finally {
    if (publicBefore === undefined) delete process.env.VAPID_PUBLIC_KEY; else process.env.VAPID_PUBLIC_KEY = publicBefore;
    if (privateBefore === undefined) delete process.env.VAPID_PRIVATE_KEY; else process.env.VAPID_PRIVATE_KEY = privateBefore;
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
