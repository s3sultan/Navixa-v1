import assert from "node:assert/strict";
import test from "node:test";
import { POST as requestCode } from "../app/api/account/code/request/route.ts";
import { POST as verifyCode } from "../app/api/account/code/verify/route.ts";
import { GET as getSession } from "../app/api/account/session/route.ts";
import { POST as logout } from "../app/api/account/logout/route.ts";

type CodeRow = { id: string; emailHash: string; codeHash: string; purpose: string; createdAt: string; expiresAt: string; consumedAt: string; attempts: number };
type UserRow = { id: string; email: string; emailHash: string; status: string };
type SessionRow = { id: string; userId: string; tokenHash: string; expiresAt: string; revokedAt: string };
type SubscriberRow = { id: string; userId: string; contact: string; plan: string; status: string; trialEndsAt: string; subscriptionEndsAt: string };

class LocalAuthDatabase {
  settings = new Map<string, string>([["user_auth_enabled", "true"], ["email_otp_enabled", "true"], ["passkeys_enabled", "true"], ["early_access_enabled", "true"], ["trial_days", "14"]]);
  codes: CodeRow[] = [];
  users: UserRow[] = [];
  sessions: SessionRow[] = [];
  subscribers: SubscriberRow[] = [];

  prepare(sql: string) {
    let values: unknown[] = [];
    const normalized = sql.replace(/\s+/g, " ").trim().toLowerCase();
    const statement = {
      bind(...next: unknown[]) { values = next; return statement; },
      all: async <T = Record<string, unknown>>() => {
        if (normalized.startsWith("select setting_key,setting_value from navixa_user_auth_settings")) return { results: [...this.settings.entries()].map(([setting_key, setting_value]) => ({ setting_key, setting_value })) as T[] };
        if (normalized.includes("from navixa_user_login_codes") && normalized.includes("consumed_at=''")) {
          const [emailHash, ,] = values as [string, string, string];
          const result = this.codes.filter(row => row.emailHash === emailHash && !row.consumedAt && Date.parse(row.expiresAt) > Date.now()).sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0];
          return { results: result ? [{ id: result.id, code_hash: result.codeHash, attempts: result.attempts }] as T[] : [] };
        }
        if (normalized.includes("from navixa_users where email_hash")) {
          const row = this.users.find(item => item.emailHash === values[0]);
          return { results: row ? [{ id: row.id, status: row.status }] as T[] : [] };
        }
        if (normalized.includes("from navixa_subscribers where user_id")) {
          const row = this.subscribers.find(item => item.userId === values[0] || item.contact === values[1]);
          if (normalized.startsWith("select plan")) return { results: row ? [{ plan: row.plan, status: row.status, trial_ends_at: row.trialEndsAt, subscription_ends_at: row.subscriptionEndsAt }] as T[] : [] };
          return { results: row ? [{ id: row.id, status: row.status }] as T[] : [] };
        }
        if (normalized.includes("from navixa_user_sessions s join navixa_users")) {
          const session = this.sessions.find(item => item.tokenHash === values[0] && !item.revokedAt);
          const user = session ? this.users.find(item => item.id === session.userId) : null;
          return { results: session && user ? [{ user_id: user.id, email: user.email, status: user.status, expires_at: session.expiresAt }] as T[] : [] };
        }
        throw new Error(`Unhandled SELECT: ${sql}`);
      },
      run: async () => {
        if (normalized.startsWith("update navixa_user_login_codes set consumed_at") && normalized.includes("where email_hash")) {
          for (const row of this.codes) if (row.emailHash === values[1] && row.purpose === "login" && !row.consumedAt) row.consumedAt = String(values[0]);
          return {};
        }
        if (normalized.startsWith("insert into navixa_user_login_codes")) {
          const [id, emailHash, codeHash, purpose, createdAt, expiresAt] = values as string[];
          this.codes.push({ id, emailHash, codeHash, purpose, createdAt, expiresAt, consumedAt: "", attempts: 0 });
          return {};
        }
        if (normalized.startsWith("update navixa_user_login_codes set attempts")) {
          const row = this.codes.find(item => item.id === values[0]); if (row) row.attempts += 1;
          return {};
        }
        if (normalized.startsWith("update navixa_user_login_codes set consumed_at")) {
          const row = this.codes.find(item => item.id === values[1]); if (row && !row.consumedAt) row.consumedAt = String(values[0]);
          return {};
        }
        if (normalized.startsWith("insert into navixa_users")) {
          const [id, email, emailHash] = values as string[];
          this.users.push({ id, email, emailHash, status: "active" }); return {};
        }
        if (normalized.startsWith("update navixa_users set status='active'")) return {};
        if (normalized.startsWith("insert into navixa_subscribers")) {
          const [id, userId, contact, trialStart, trialEnd] = values as string[];
          this.subscribers.push({ id, userId, contact, plan: "trial", status: "trial", trialEndsAt: trialEnd, subscriptionEndsAt: "" });
          assert.ok(Date.parse(trialEnd) > Date.parse(trialStart)); return {};
        }
        if (normalized.startsWith("update navixa_subscribers set user_id")) return {};
        if (normalized.startsWith("insert into navixa_user_sessions")) {
          const [id, userId, tokenHash, , expiresAt] = values as string[];
          this.sessions.push({ id, userId, tokenHash, expiresAt, revokedAt: "" }); return {};
        }
        if (normalized.startsWith("update navixa_user_sessions set expires_at")) {
          const row = this.sessions.find(item => item.tokenHash === values[2] && !item.revokedAt); if (row) row.expiresAt = String(values[0]); return {};
        }
        if (normalized.startsWith("update navixa_user_sessions set revoked_at")) {
          const row = this.sessions.find(item => item.tokenHash === values[1] && !item.revokedAt); if (row) row.revokedAt = String(values[0]); return {};
        }
        throw new Error(`Unhandled mutation: ${sql}`);
      },
    };
    return statement;
  }
}

const origin = "https://navixa.local";
function post(path: string, body: unknown, extra: Record<string, string> = {}) { return new Request(`${origin}${path}`, { method: "POST", headers: { origin, "content-type": "application/json", ...extra }, body: JSON.stringify(body) }); }

test("local passwordless flow issues one-time code, grants one trial, creates a server session, and blocks reuse", async () => {
  const database = new LocalAuthDatabase();
  const host = globalThis as typeof globalThis & { DB?: LocalAuthDatabase; RESEND_API_KEY?: string; NAVIXA_AUTH_FROM?: string; NAVIXA_AUTH_CODE_PEPPER?: string };
  const previous = { DB: host.DB, key: host.RESEND_API_KEY, from: host.NAVIXA_AUTH_FROM, pepper: host.NAVIXA_AUTH_CODE_PEPPER, fetch: globalThis.fetch };
  let deliveredCode = "";
  host.DB = database; host.RESEND_API_KEY = "local-resend-key"; host.NAVIXA_AUTH_FROM = "دخول NAVIXA <login@navixa.local>"; host.NAVIXA_AUTH_CODE_PEPPER = "local-only-pepper-with-enough-length";
  globalThis.fetch = async (_url, init) => { const body = JSON.parse(String(init?.body || "{}")) as { text?: string }; deliveredCode = body.text?.match(/(\d{6})/)?.[1] || ""; return new Response(JSON.stringify({ id: "local-mail" }), { status: 200, headers: { "content-type": "application/json" } }); };
  try {
    const crossOrigin = await requestCode(new Request(`${origin}/api/account/code/request`, { method: "POST", headers: { origin: "https://attacker.example", "content-type": "application/json" }, body: JSON.stringify({ email: "learner@example.com" }) }));
    assert.equal(crossOrigin.status, 403);
    const requested = await requestCode(post("/api/account/code/request", { email: "learner@example.com" }, { "cf-connecting-ip": "198.51.100.7" }));
    assert.equal(requested.status, 200); assert.match(deliveredCode, /^\d{6}$/); assert.equal(database.codes.length, 1);
    const wrong = await verifyCode(post("/api/account/code/verify", { email: "learner@example.com", code: "000000" }, { "cf-connecting-ip": "198.51.100.7" }));
    assert.equal(wrong.status, 401); assert.equal(database.codes[0].attempts, 1);
    const verified = await verifyCode(post("/api/account/code/verify", { email: "learner@example.com", code: deliveredCode }, { "cf-connecting-ip": "198.51.100.7" }));
    assert.equal(verified.status, 200); assert.equal(database.users.length, 1); assert.equal(database.subscribers.length, 1); assert.equal(database.subscribers[0].status, "trial");
    const cookie = verified.headers.get("set-cookie") || ""; assert.match(cookie, /__Host-navixa_session=/); assert.match(cookie, /Path=\//); assert.match(cookie, /Max-Age=2592000/); assert.match(cookie, /HttpOnly/); assert.match(cookie, /Secure/); assert.match(cookie, /SameSite=Lax/);
    const reused = await verifyCode(post("/api/account/code/verify", { email: "learner@example.com", code: deliveredCode }, { "cf-connecting-ip": "198.51.100.7" }));
    assert.equal(reused.status, 401);
    database.sessions[0].expiresAt = new Date(Date.now() + 3 * 24 * 60 * 60_000).toISOString();
    const session = await getSession(new Request(`${origin}/api/account/session`, { headers: { cookie: cookie.split(";")[0] } }));
    assert.equal(session.status, 200); const state = await session.json() as { signedIn: boolean; plus: { status: string; plan: string }; user: { expiresAt: string } }; assert.equal(state.signedIn, true); assert.equal(state.plus.status, "trial"); assert.equal(state.plus.plan, "trial"); assert.ok(Date.parse(state.user.expiresAt) > Date.now() + 28 * 24 * 60 * 60_000); assert.match(session.headers.get("set-cookie") || "", /Max-Age=2592000/);
    const signedOut = await logout(new Request(`${origin}/api/account/logout`, { method: "POST", headers: { origin, cookie: cookie.split(";")[0] } }));
    assert.equal(signedOut.status, 200);
    const afterLogout = await getSession(new Request(`${origin}/api/account/session`, { headers: { cookie: cookie.split(";")[0] } }));
    assert.equal((await afterLogout.json() as { signedIn: boolean }).signedIn, false);
  } finally {
    if (previous.DB === undefined) delete host.DB; else host.DB = previous.DB;
    if (previous.key === undefined) delete host.RESEND_API_KEY; else host.RESEND_API_KEY = previous.key;
    if (previous.from === undefined) delete host.NAVIXA_AUTH_FROM; else host.NAVIXA_AUTH_FROM = previous.from;
    if (previous.pepper === undefined) delete host.NAVIXA_AUTH_CODE_PEPPER; else host.NAVIXA_AUTH_CODE_PEPPER = previous.pepper;
    globalThis.fetch = previous.fetch;
  }
});

test("local passwordless flow limits repeated code requests from the same network", async () => {
  const database = new LocalAuthDatabase();
  const host = globalThis as typeof globalThis & { DB?: LocalAuthDatabase; RESEND_API_KEY?: string; NAVIXA_AUTH_FROM?: string; NAVIXA_AUTH_CODE_PEPPER?: string };
  const previous = { DB: host.DB, key: host.RESEND_API_KEY, from: host.NAVIXA_AUTH_FROM, pepper: host.NAVIXA_AUTH_CODE_PEPPER, fetch: globalThis.fetch };
  host.DB = database; host.RESEND_API_KEY = "local-resend-key"; host.NAVIXA_AUTH_FROM = "دخول NAVIXA <login@navixa.local>"; host.NAVIXA_AUTH_CODE_PEPPER = "local-only-pepper-with-enough-length";
  globalThis.fetch = async () => new Response(JSON.stringify({ id: "local-mail" }), { status: 200, headers: { "content-type": "application/json" } });
  try {
    for (let index = 0; index < 5; index += 1) {
      const response = await requestCode(post("/api/account/code/request", { email: `person${index}@example.com` }, { "cf-connecting-ip": "203.0.113.91" }));
      assert.equal(response.status, 200);
    }
    const blocked = await requestCode(post("/api/account/code/request", { email: "sixth@example.com" }, { "cf-connecting-ip": "203.0.113.91" }));
    assert.equal(blocked.status, 429);
    const retryAfter = Number(blocked.headers.get("Retry-After"));
    assert.ok(Number.isInteger(retryAfter) && retryAfter >= 1 && retryAfter <= 600);
  } finally {
    if (previous.DB === undefined) delete host.DB; else host.DB = previous.DB;
    if (previous.key === undefined) delete host.RESEND_API_KEY; else host.RESEND_API_KEY = previous.key;
    if (previous.from === undefined) delete host.NAVIXA_AUTH_FROM; else host.NAVIXA_AUTH_FROM = previous.from;
    if (previous.pepper === undefined) delete host.NAVIXA_AUTH_CODE_PEPPER; else host.NAVIXA_AUTH_CODE_PEPPER = previous.pepper;
    globalThis.fetch = previous.fetch;
  }
});

test("OTP delivery retries one transient provider failure", async () => {
  const database = new LocalAuthDatabase();
  const host = globalThis as typeof globalThis & { DB?: LocalAuthDatabase; RESEND_API_KEY?: string; RESEND_FROM_EMAIL?: string; NAVIXA_AUTH_CODE_PEPPER?: string };
  const previous = { DB: host.DB, key: host.RESEND_API_KEY, from: host.RESEND_FROM_EMAIL, pepper: host.NAVIXA_AUTH_CODE_PEPPER, fetch: globalThis.fetch };
  let attempts = 0;
  host.DB = database; host.RESEND_API_KEY = "local-resend-key"; host.RESEND_FROM_EMAIL = "دخول NAVIXA <login@navixa.local>"; host.NAVIXA_AUTH_CODE_PEPPER = "local-only-pepper-with-enough-length";
  globalThis.fetch = async () => { attempts += 1; return attempts === 1 ? new Response("temporary", { status: 503 }) : new Response(JSON.stringify({ id: "local-mail" }), { status: 200 }); };
  try {
    const response = await requestCode(post("/api/account/code/request", { email: "retry@example.com" }, { "cf-connecting-ip": "198.51.100.88" }));
    assert.equal(response.status, 200);
    assert.equal(attempts, 2);
    assert.equal(database.codes.filter(row => !row.consumedAt).length, 1);
  } finally {
    if (previous.DB === undefined) delete host.DB; else host.DB = previous.DB;
    if (previous.key === undefined) delete host.RESEND_API_KEY; else host.RESEND_API_KEY = previous.key;
    if (previous.from === undefined) delete host.RESEND_FROM_EMAIL; else host.RESEND_FROM_EMAIL = previous.from;
    if (previous.pepper === undefined) delete host.NAVIXA_AUTH_CODE_PEPPER; else host.NAVIXA_AUTH_CODE_PEPPER = previous.pepper;
    globalThis.fetch = previous.fetch;
  }
});
