import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";
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
import { POST as shareAssistantLearning } from "../app/api/assistant-learning/route.ts";
import { GET as getAssistantLearningReview } from "../app/api/admin/assistant-learning/route.ts";
import { GET as getSubscriptions } from "../app/api/admin/subscriptions/route.ts";
import { GET as getBillingSettings } from "../app/api/admin/billing-settings/route.ts";
import { GET as getBillingWebhook, POST as billingWebhook } from "../app/api/billing/webhook/route.ts";
import { POST as registerPlusInterest } from "../app/api/plus/interest/route.ts";
import { POST as reportPerformance } from "../app/api/performance/route.ts";
import { GET as getAdminReferrals } from "../app/api/admin/referrals/route.ts";
import { GET as getAdminMeetingSettings, POST as saveAdminMeetingSettings } from "../app/api/admin/meeting-settings/route.ts";
import { GET as getMeetingPolicy } from "../app/api/meetings/policy/route.ts";
import { POST as shareMeetingGlossary } from "../app/api/meetings/glossary/route.ts";
import { GET as getAdminMeetingGlossary } from "../app/api/admin/meeting-glossary/route.ts";
import { createCode } from "../app/referrals.ts";
import { mergeMeetingParts, pendingMeetingParts } from "../app/meetings/meetingSummary.ts";
import type { MeetingPart } from "../app/meetings/meetingStore.ts";
import { applyGlossary, detectSingleWordCorrection, extractFrequentTerms, parseGlossaryInput } from "../app/meetings/meetingGlossary.ts";
import { GET as getAccountSession } from "../app/api/account/session/route.ts";
import { POST as requestAccountCode } from "../app/api/account/code/request/route.ts";
import { POST as verifyAccountCode } from "../app/api/account/code/verify/route.ts";
import { POST as registerPasskeyOptions } from "../app/api/account/passkeys/register/options/route.ts";
import { makeUserSessionCookie } from "../worker/userAuth.ts";

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

test("Push subscription stores every selected alert time without duplicates", async () => {
  const statements: Array<{sql:string;values:unknown[]}> = [];
  const database = { prepare(sql:string) { const statement = { bind(...values:unknown[]) { statements.push({sql,values}); return statement; }, async run() { return {}; } }; return statement; } };
  const host = globalThis as typeof globalThis & { DB?: typeof database };
  const prior = host.DB; host.DB = database;
  try {
    const response = await savePushSubscription(post("/api/push/subscriptions", { endpoint:"https://push.example/device", keys:{p256dh:"1234567890123456",auth:"12345678"}, competitions:["rsl"], teams:["الهلال"], beforeMinutesList:[5,30,15,5,0], plan:"plus", paymentVerified:true, subscriberId:"attempted-escalation" }));
    assert.equal(response.status,200);
    const insert = statements.find(item=>item.sql.startsWith("INSERT INTO navixa_push_subscriptions"));
    assert.ok(insert);
    assert.equal(insert.values[6],30);
    assert.equal(insert.values[7],"[30,15,5,0]");
    assert.equal(statements.some(item=>item.sql.includes("navixa_subscribers")||item.sql.includes("billing")),false);
  } finally { if(prior===undefined) delete host.DB; else host.DB=prior; }
});

test("global assistant learning requires same-origin consent and admin review stays protected", async () => {
  const shared = await shareAssistantLearning(new Request(`${appOrigin}/api/assistant-learning`, { method: "POST", headers: { origin: "https://attacker.example", "content-type": "application/json" }, body: JSON.stringify({ question: "كيف أرتب يومي؟", response: "ابدأ بخطوة واحدة" }) }));
  assert.equal(shared.status, 403);
  const forbidden = await shareAssistantLearning(post("/api/assistant-learning", { question: "كلمة مرور الحساب", response: "لا تشاركها" }));
  assert.equal(forbidden.status, 400);
  const review = await getAssistantLearningReview(new Request(`${appOrigin}/api/admin/assistant-learning`));
  assert.equal(review.status, 401);
});

test("subscription administration stays protected and the billing webhook is locked by default", async () => {
  const subscriptions = await getSubscriptions(new Request(`${appOrigin}/api/admin/subscriptions`));
  assert.equal(subscriptions.status, 401);
  const billingSettings = await getBillingSettings(new Request(`${appOrigin}/api/admin/billing-settings`));
  assert.equal(billingSettings.status, 401);
  const status = await getBillingWebhook();
  assert.equal(status.status, 200);
  assert.deepEqual(await status.json(), { billing:"disabled",mode:"test",message:"بوابة الدفع مخفية ومقفلة حتى يفعّلها المدير. لا يتم قبول أي دفعات أو بيانات بطاقات الآن." });
  const webhook = await billingWebhook(new Request(`${appOrigin}/api/billing/webhook`, { method:"POST",headers:{"content-type":"application/json"},body:"{}" }));
  assert.equal(webhook.status,503);
  const crossOriginInterest = await registerPlusInterest(new Request(`${appOrigin}/api/plus/interest`, { method:"POST",headers:{origin:"https://attacker.example","content-type":"application/json"},body:JSON.stringify({email:"test@example.com"}) }));
  assert.equal(crossOriginInterest.status,403);
});

test("referral administration stays protected and generated codes use the NAVIXA format", async () => {
  const referrals = await getAdminReferrals(new Request(`${appOrigin}/api/admin/referrals`));
  assert.equal(referrals.status, 401);
  assert.match(createCode(), /^NVX-[A-Z0-9]{8}$/);
});

test("Plus interest records only a contact through the same-origin endpoint", async () => {
  const statements: Array<{sql:string;values:unknown[]}> = [];
  const database = { prepare(sql:string) { const statement = { bind(...values:unknown[]) { statements.push({sql,values}); return statement; }, async run() { return {}; } }; return statement; } };
  const host = globalThis as typeof globalThis & { DB?: typeof database };const prior=host.DB;host.DB=database;
  try { const response=await registerPlusInterest(post("/api/plus/interest",{email:"early@example.com",name:"مستخدم مبكر"}));assert.equal(response.status,200);assert.equal((await response.json() as {ok:boolean}).ok,true);assert.ok(statements.some(item=>item.sql.startsWith("INSERT INTO navixa_subscribers"))); }
  finally { if(prior===undefined) delete host.DB; else host.DB=prior; }
});

test("performance telemetry rejects cross-origin input and stores only bounded anonymous timings", async () => {
  const statements: Array<{sql:string;values:unknown[]}> = [];
  const database = { prepare(sql:string) { const statement = { bind(...values:unknown[]) { statements.push({sql,values}); return statement; }, async run() { return {}; } }; return statement; } };
  const host = globalThis as typeof globalThis & { DB?: typeof database }; const prior = host.DB; host.DB = database;
  try {
    const denied = await reportPerformance(new Request(`${appOrigin}/api/performance`, { method: "POST", headers: { origin: "https://attacker.example", "content-type": "application/json" }, body: JSON.stringify({ path: "/health", ttfbMs: 10, loadMs: 20 }) }));
    assert.equal(denied.status, 403);
    const accepted = await reportPerformance(post("/api/performance", { path: "/health", ttfbMs: 123.4, loadMs: 456.7, visitorId: "ignored" }));
    assert.equal(accepted.status, 200);
    const insert = statements.find(item => item.sql.startsWith("INSERT INTO navixa_performance_samples"));
    assert.ok(insert);
    assert.deepEqual(insert.values.slice(0,3), ["/health",123,457]);
    assert.equal(insert.values.some(value => value === "ignored"), false);
    const invalid = await reportPerformance(post("/api/performance", { path: "/admin", ttfbMs: 1, loadMs: 2 }));
    assert.equal(invalid.status, 400);
  } finally { if (prior === undefined) delete host.DB; else host.DB = prior; }
});

test("meeting settings remain admin-only and the public policy never exposes local session content", async () => {
  const admin = await getAdminMeetingSettings(new Request(`${appOrigin}/api/admin/meeting-settings`));
  assert.equal(admin.status, 401);
  const mutation = await saveAdminMeetingSettings(new Request(`${appOrigin}/api/admin/meeting-settings`, { method:"POST", headers:{origin:"https://attacker.example","content-type":"application/json"}, body:JSON.stringify({ featureEnabled:true, transcript:"attempt", audio:"attempt", visitorId:"attempt" }) }));
  assert.equal(mutation.status, 401);
  const policy = await getMeetingPolicy();
  assert.equal(policy.status, 200);
  const body = await policy.json() as Record<string,unknown>;
  assert.equal(body.enabled, true);
  assert.equal("transcript" in body, false);
  assert.equal("audio" in body, false);
  assert.equal("visitorId" in body, false);
});

test("local STT model relay is a strict public-file allowlist and never receives audio", async () => {
  const workerSource = await readFile(new URL("../worker/index.ts", import.meta.url), "utf8");
  assert.match(workerSource, /LOCAL_STT_MODELS = new Set\(\["Xenova\/whisper-tiny", "Xenova\/whisper-base"\]\)/);
  assert.match(workerSource, /LOCAL_STT_MODEL_FILES = new Set/);
  assert.match(workerSource, /url\.search\) return null/);
  assert.match(workerSource, /https:\/\/huggingface\.co\/\$\{source\.model\}\/resolve\/main\/\$\{source\.file\}/);
  assert.doesNotMatch(workerSource, /request\.text\(|request\.json\(|request\.arrayBuffer\(/);
});

test("local meeting parts merge with chronological timestamps and preserve pending work for resumption", () => {
  const first: MeetingPart = { id:"p1",index:0,startMs:0,durationMs:1_800_000,audio:null,status:"complete",transcript:"تم الاتفاق على بداية المشروع. المهمة: أرسل الخطة اليوم.",segments:[{start:0,end:4,text:"تم الاتفاق على بداية المشروع."}],summary:"بداية المشروع.",decisions:["تم الاتفاق على بداية المشروع."],tasks:["أرسل الخطة اليوم."],questions:[],model:"tiny" };
  const second: MeetingPart = { id:"p2",index:1,startMs:1_800_000,durationMs:1_800_000,audio:null,status:"complete",transcript:"قرر الفريق مراجعة النتيجة. يجب متابعة التنفيذ.",segments:[{start:5,end:9,text:"قرر الفريق مراجعة النتيجة."}],summary:"مراجعة النتيجة.",decisions:["قرر الفريق مراجعة النتيجة."],tasks:["متابعة التنفيذ."],questions:[],model:"tiny" };
  const pending: MeetingPart = { id:"p3",index:2,startMs:3_600_000,durationMs:300_000,audio:null,status:"pending",transcript:"",segments:[],summary:"",decisions:[],tasks:[],questions:[],model:null };
  const merged = mergeMeetingParts([first, second, pending]);
  assert.match(merged.transcript, /بداية المشروع/);
  assert.match(merged.transcript, /مراجعة النتيجة/);
  assert.equal(merged.segments[1].start, 1805);
  assert.deepEqual(merged.decisions, ["تم الاتفاق على بداية المشروع.", "قرر الفريق مراجعة النتيجة."]);
  assert.equal(pendingMeetingParts([first, second, pending])[0].id, "p3");
});

test("user account endpoints keep anonymous state private and reject cross-origin login or Passkey requests", async () => {
  const session = await getAccountSession(new Request(`${appOrigin}/api/account/session`));
  assert.ok([200,503].includes(session.status));
  if (session.status === 200) assert.deepEqual(await session.json(), { enabled: false, signedIn: false });
  const code = await requestAccountCode(new Request(`${appOrigin}/api/account/code/request`, { method:"POST", headers:{origin:"https://attacker.example","content-type":"application/json"}, body:JSON.stringify({email:"user@example.com"}) }));
  assert.equal(code.status, 403);
  const verify = await verifyAccountCode(new Request(`${appOrigin}/api/account/code/verify`, { method:"POST", headers:{origin:"https://attacker.example","content-type":"application/json"}, body:JSON.stringify({email:"user@example.com",code:"123456"}) }));
  assert.equal(verify.status, 403);
  const passkey = await registerPasskeyOptions(new Request(`${appOrigin}/api/account/passkeys/register/options`, { method:"POST", headers:{origin:appOrigin,cookie:makeUserSessionCookie("x".repeat(43)).split(";")[0]} }));
  assert.ok([401,404,503].includes(passkey.status));
  assert.match(makeUserSessionCookie("x".repeat(43)), /HttpOnly/);
  assert.match(makeUserSessionCookie("x".repeat(43)), /SameSite=Lax/);
});

test("meeting glossary review remains protected by the server-side admin session", async () => {
  const response = await getAdminMeetingGlossary(new Request(`${appOrigin}/api/admin/meeting-glossary`));
  assert.equal(response.status,401);
});

test("meeting glossary stays opt-in and corrects only known local term aliases", async () => {
  const crossOrigin = await shareMeetingGlossary(new Request(`${appOrigin}/api/meetings/glossary`, { method:"POST", headers:{origin:"https://attacker.example","content-type":"application/json"}, body:JSON.stringify({consent:true,terms:[{canonical:"NAVIXA",aliases:["نافكسا"]}]}) }));
  assert.equal(crossOrigin.status,403);
  const noConsent = await shareMeetingGlossary(post("/api/meetings/glossary",{consent:false,terms:[{canonical:"NAVIXA",aliases:["نافكسا"]}]}));
  assert.equal(noConsent.status,409);
  const privateInput = await shareMeetingGlossary(post("/api/meetings/glossary",{consent:true,terms:[{canonical:"test@example.com",aliases:[]}]}));
  assert.equal(privateInput.status,400);
  const terms = parseGlossaryInput("NAVIXA — نافكسا, نافيكسا\nCloudflare Workers — كلاود فلير ووركرز");
  assert.equal(applyGlossary("بدأت نافكسا على كلاود فلير ووركرز",terms),"بدأت NAVIXA على Cloudflare Workers");
  assert.deepEqual(detectSingleWordCorrection("نافكسا تعمل","نافيكسا تعمل"),{from:"نافكسا",to:"نافيكسا"});
  assert.equal(extractFrequentTerms("NAVIXA NAVIXA NAVIXA مهمة")[0].canonical,"NAVIXA");
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
