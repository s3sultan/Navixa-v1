import { NextResponse } from "next/server.js";
import { ADMIN_SESSION_COOKIE, isTrustedSameOriginRequest, readCookie, resolveAdminJwtSecret, verifyAdminSessionToken } from "../../../../worker/adminAuth.ts";

type D1Statement = { bind: (...values: unknown[]) => D1Statement; all: <T = Record<string, unknown>>() => Promise<{ results: T[] }>; run: () => Promise<unknown> };
type D1Database = { prepare: (query: string) => D1Statement };
type Env = Record<string, string | undefined>;
type Provider = "moyasar" | "hyperpay" | "paytabs" | "tap" | "telr" | "other";

const providers: Provider[] = ["moyasar", "hyperpay", "paytabs", "tap", "telr", "other"];
const clean = (value: unknown, limit: number) => typeof value === "string" ? value.trim().toLowerCase().slice(0, limit) : "";
const validDomain = (value: string) => !value || /^(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}$/.test(value);
const validEmail = (value: string) => !value || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);

async function db(): Promise<D1Database | null> {
  try { return (await import("cloudflare:workers") as { env?: { DB?: D1Database } }).env?.DB || null; }
  catch { return (globalThis as { DB?: D1Database }).DB || null; }
}
async function runtimeEnv(): Promise<Env> {
  try { return (await import("cloudflare:workers") as { env?: Env }).env || {}; }
  catch { return globalThis as Env; }
}
async function allowed(request: Request) {
  const secret = await resolveAdminJwtSecret();
  return Boolean(secret && (request.method === "GET" || isTrustedSameOriginRequest(request)) && await verifyAdminSessionToken(readCookie(request, ADMIN_SESSION_COOKIE), secret));
}
async function schema(database: D1Database) {
  await database.prepare("CREATE TABLE IF NOT EXISTS navixa_service_transition_settings (setting_key TEXT PRIMARY KEY, setting_value TEXT NOT NULL, updated_at TEXT NOT NULL)").run();
}
async function readSettings(database: D1Database) {
  await schema(database);
  const rows = await database.prepare("SELECT setting_key,setting_value FROM navixa_service_transition_settings").all<{ setting_key: string; setting_value: string }>();
  return new Map(rows.results.map(row => [row.setting_key, row.setting_value]));
}
function links() {
  return {
    cloudflareDns: "https://dash.cloudflare.com/e84db6c2e3c943b7cbe3e59f24832e8a/navixasa.com/dns/records",
    cloudflareEmailRouting: "https://dash.cloudflare.com/e84db6c2e3c943b7cbe3e59f24832e8a/navixasa.com/email/routing",
    cloudflareWorker: "https://dash.cloudflare.com/e84db6c2e3c943b7cbe3e59f24832e8a/workers/services/view/navixa/production/settings",
    resendDomains: "https://resend.com/domains",
  };
}
function response(settings: Map<string, string>, env: Env) {
  return {
    activeProvider: "moyasar",
    activeDomain: "navixasa.com",
    candidateProvider: settings.get("candidate_provider") || "moyasar",
    candidateDomain: settings.get("candidate_domain") || "",
    requestedSender: settings.get("requested_sender") || "",
    replyTo: settings.get("reply_to") || "",
    senderConfigured: Boolean(env.RESEND_API_KEY && (env.RESEND_FROM_EMAIL || env.NAVIXA_AUTH_FROM)),
    links: links(),
  };
}
function noStore(body: Record<string, unknown>, status = 200) {
  return NextResponse.json(body, { status, headers: { "Cache-Control": "no-store" } });
}

export async function GET(request: Request) {
  if (!await allowed(request)) return noStore({ error: "غير مصرح" }, 401);
  const database = await db();
  if (!database) return noStore({ error: "التخزين غير مهيأ" }, 503);
  return noStore(response(await readSettings(database), await runtimeEnv()));
}

export async function POST(request: Request) {
  if (!await allowed(request)) return noStore({ error: "غير مصرح" }, 401);
  const database = await db();
  if (!database) return noStore({ error: "التخزين غير مهيأ" }, 503);
  const body = await request.json().catch(() => ({})) as { candidateProvider?: unknown; candidateDomain?: unknown; requestedSender?: unknown; replyTo?: unknown };
  const candidateProvider = clean(body.candidateProvider, 24) as Provider;
  const candidateDomain = clean(body.candidateDomain, 253).replace(/^https?:\/\//, "").replace(/\/$/, "");
  const requestedSender = clean(body.requestedSender, 160);
  const replyTo = clean(body.replyTo, 160);
  if (!providers.includes(candidateProvider)) return noStore({ error: "اختر مزود دفع مدعومًا من القائمة" }, 400);
  if (!validDomain(candidateDomain)) return noStore({ error: "اكتب الدومين فقط، مثل navixa.sa، من دون https أو مسار" }, 400);
  if (!validEmail(requestedSender) || !validEmail(replyTo)) return noStore({ error: "أدخل عنوان بريد إلكتروني صحيحًا" }, 400);
  const now = new Date().toISOString();
  await schema(database);
  for (const [key, value] of Object.entries({ candidate_provider: candidateProvider, candidate_domain: candidateDomain, requested_sender: requestedSender, reply_to: replyTo })) {
    await database.prepare("INSERT INTO navixa_service_transition_settings(setting_key,setting_value,updated_at) VALUES (?,?,?) ON CONFLICT(setting_key) DO UPDATE SET setting_value=excluded.setting_value,updated_at=excluded.updated_at").bind(key, value, now).run();
  }
  return noStore({ ok: true, message: "تم حفظ خطة الانتقال. لا تتغير بوابة الدفع أو DNS أو بريد الإرسال تلقائيًا؛ أكمل التحقق من الروابط الرسمية ثم نفّذ التبديل بعد الاختبار.", ...response(await readSettings(database), await runtimeEnv()) });
}
