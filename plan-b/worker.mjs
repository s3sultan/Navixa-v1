const encoder = new TextEncoder();
const decoder = new TextDecoder();
const MAX_GRANT_SECONDS = 15 * 60;
const MAX_TOKEN_LENGTH = 4096;
const PLAN_B_HOST = "backup.navixasa.com";
const PRIMARY_HEALTH_URL = "https://navixasa.com/api/healthz";
const PRIMARY_ORIGIN_HEALTH_URL = "https://navixa.s2shug.workers.dev/api/healthz";
const MONITOR_STATE_KEY = "monitor/state-v1.json";
const FAILURE_THRESHOLD = 3;
const RECOVERY_THRESHOLD = 3;

const html = `<!doctype html>
<html lang="ar" dir="rtl">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">
  <meta name="robots" content="noindex,nofollow,noarchive">
  <title>NAVIXA | وضع الطوارئ</title>
  <link rel="stylesheet" href="/styles.css">
</head>
<body>
  <main class="shell">
    <header class="brand">
      <span class="mark">N</span>
      <div><strong>NAVIXA</strong><small>وضع الطوارئ</small></div>
    </header>

    <section id="checking" class="card">
      <span class="status-dot" aria-hidden="true"></span>
      <div><h1>جاري التحقق من تصريح الطوارئ</h1><p>لن يتم إرسال بيانات حسابك إلى الموقع الأساسي أثناء التحقق.</p></div>
    </section>

    <section id="denied" class="card hidden" aria-live="polite">
      <div><h1>الرابط غير صالح أو انتهت صلاحيته</h1><p>تصاريح الطوارئ قصيرة العمر ومخصصة لحادث واحد فقط.</p></div>
      <a class="button secondary" href="https://navixasa.com">فتح NAVIXA الأساسي</a>
    </section>

    <section id="ready" class="hidden" aria-live="polite">
      <div class="card success">
        <div><h1>المنصة الاحتياطية جاهزة</h1><p>تم التحقق من تصريح هِمّة لهذا الحادث. هذه النسخة تعمل بشكل مستقل عن قاعدة بيانات NAVIXA الأساسية.</p></div>
        <span id="expiry" class="pill"></span>
      </div>

      <div class="card stack">
        <div><h2>مساحة مؤقتة على جهازك</h2><p>اكتب أي مهام أو ملاحظات تحتاجها أثناء العطل. تحفظ محليًا في هذا الجهاز فقط ولا تُرسل إلى أي خادم.</p></div>
        <textarea id="notes" rows="8" maxlength="6000" placeholder="اكتب ملاحظاتك هنا..."></textarea>
        <div class="actions">
          <button id="save" class="button" type="button">حفظ على الجهاز</button>
          <button id="clear" class="button secondary" type="button">مسح</button>
        </div>
        <p id="saved" class="saved" aria-live="polite"></p>
      </div>

      <div class="card compact">
        <div><h2>الخدمة الأساسية</h2><p>عند عودة NAVIXA واستقرارها ستصلك رسالة العودة عبر القنوات المفعلة لديك.</p></div>
        <a class="button secondary" href="https://navixasa.com">فحص الموقع الأساسي</a>
      </div>
    </section>

    <footer>navixa يفهم يومك</footer>
  </main>
  <script src="/app.js" defer></script>
</body>
</html>`;

const css = `
:root{color-scheme:light;font-family:Inter,"Segoe UI",Tahoma,Arial,sans-serif;background:#f7f8fb;color:#15171c}
*{box-sizing:border-box}body{margin:0;min-height:100vh;background:radial-gradient(circle at top right,#fff2e8 0,#f7f8fb 38%,#f7f8fb 100%)}
a{color:inherit;text-decoration:none}.shell{width:min(720px,calc(100% - 28px));margin:0 auto;padding:32px 0 40px}
.brand{display:flex;align-items:center;gap:12px;margin-bottom:24px}.brand .mark{display:grid;place-items:center;width:42px;height:42px;border-radius:14px;background:#fff;border:1px solid #eadfd6;font-weight:900;font-size:21px}.brand div{display:flex;flex-direction:column}.brand strong{letter-spacing:.12em}.brand small{color:#6a6f78;margin-top:3px}
.card{background:rgba(255,255,255,.94);border:1px solid #e8e9ed;border-radius:24px;padding:22px;box-shadow:0 18px 55px rgba(30,32,38,.07);display:flex;align-items:center;justify-content:space-between;gap:18px;margin-bottom:16px}.card.stack{display:block}.card.compact{align-items:flex-start}.card.success{border-color:#d7e8dc;background:#fbfffc}
h1,h2,p{margin:0}h1{font-size:1.22rem;line-height:1.55}h2{font-size:1.06rem;margin-bottom:5px}p{color:#666c76;line-height:1.75;font-size:.94rem}.status-dot{width:12px;height:12px;border-radius:50%;background:#f08b3e;box-shadow:0 0 0 8px #fff0e3;flex:0 0 auto}.pill{white-space:nowrap;border-radius:999px;background:#eef7f0;padding:8px 11px;font-size:.8rem;color:#356143}
textarea{width:100%;margin-top:16px;resize:vertical;border:1px solid #dfe1e6;border-radius:16px;padding:14px;font:inherit;line-height:1.7;background:#fff;color:#15171c;outline:none}textarea:focus{border-color:#aeb3bd;box-shadow:0 0 0 3px rgba(120,125,135,.1)}
.actions{display:flex;gap:10px;margin-top:12px}.button{display:inline-flex;align-items:center;justify-content:center;min-height:42px;border:0;border-radius:13px;padding:9px 15px;background:#181a1f;color:#fff;font:inherit;font-weight:700;cursor:pointer}.button.secondary{background:#f1f2f4;color:#25282e}.saved{min-height:24px;margin-top:9px;font-size:.82rem;color:#467455}.hidden{display:none!important}footer{text-align:center;color:#9a9da5;font-size:.8rem;margin-top:28px}
@media(max-width:560px){.shell{padding-top:22px}.card{padding:18px;border-radius:20px;align-items:flex-start;flex-direction:column}.card.success,.card.compact{align-items:stretch}.pill{align-self:flex-start}.actions{display:grid;grid-template-columns:1fr 1fr}.button{width:100%}}
`;

const js = `(() => {
  const checking = document.getElementById('checking');
  const denied = document.getElementById('denied');
  const ready = document.getElementById('ready');
  const expiry = document.getElementById('expiry');
  const notes = document.getElementById('notes');
  const saved = document.getElementById('saved');
  const storageKey = 'navixa.plan-b.notes.v1';

  const showDenied = () => {
    checking.classList.add('hidden');
    ready.classList.add('hidden');
    denied.classList.remove('hidden');
  };

  const params = new URLSearchParams(location.hash.replace(/^#/, ''));
  const token = params.get('grant') || '';
  history.replaceState(null, '', location.pathname + location.search);
  if (!token) return showDenied();

  fetch('/api/verify', {
    method: 'POST',
    headers: {'content-type': 'application/json'},
    credentials: 'omit',
    cache: 'no-store',
    body: JSON.stringify({token})
  }).then(async response => {
    if (!response.ok) throw new Error('denied');
    return response.json();
  }).then(result => {
    if (!result.ok || !result.expiresAt) throw new Error('denied');
    checking.classList.add('hidden');
    denied.classList.add('hidden');
    ready.classList.remove('hidden');
    expiry.textContent = 'صالح حتى ' + new Intl.DateTimeFormat('ar-SA', {hour:'2-digit',minute:'2-digit'}).format(new Date(result.expiresAt));
    try { notes.value = localStorage.getItem(storageKey) || ''; } catch {}
  }).catch(showDenied);

  document.getElementById('save').addEventListener('click', () => {
    try {
      localStorage.setItem(storageKey, notes.value);
      saved.textContent = 'تم الحفظ على هذا الجهاز';
    } catch { saved.textContent = 'تعذر الحفظ على هذا الجهاز'; }
  });
  document.getElementById('clear').addEventListener('click', () => {
    notes.value = '';
    try { localStorage.removeItem(storageKey); } catch {}
    saved.textContent = 'تم المسح';
  });
})();`;

function b64urlDecode(value) {
  if (!/^[A-Za-z0-9_-]+$/.test(value)) throw new Error("invalid_base64url");
  const padded = value.replace(/-/g, "+").replace(/_/g, "/") + "=".repeat((4 - value.length % 4) % 4);
  const binary = atob(padded);
  return Uint8Array.from(binary, char => char.charCodeAt(0));
}

async function hmacKey(secret) {
  if (!secret || secret.length < 32) throw new Error("verifier_not_ready");
  return crypto.subtle.importKey("raw", encoder.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["verify"]);
}

export async function verifyPlanBGrantToken(token, signingSecret, now = new Date()) {
  if (typeof token !== "string" || token.length < 20 || token.length > MAX_TOKEN_LENGTH) return null;
  const [body, signature, extra] = token.split(".");
  if (!body || !signature || extra) return null;
  try {
    const key = await hmacKey(signingSecret);
    const valid = await crypto.subtle.verify("HMAC", key, b64urlDecode(signature), encoder.encode(body));
    if (!valid) return null;
    const payload = JSON.parse(decoder.decode(b64urlDecode(body)));
    const nowSeconds = Math.floor(now.getTime() / 1000);
    if (payload?.v !== 1 || typeof payload.sub !== "string" || !payload.sub || typeof payload.incident !== "string" || !payload.incident) return null;
    if (!Number.isInteger(payload.iat) || !Number.isInteger(payload.exp)) return null;
    if (payload.iat > nowSeconds + 60 || payload.exp <= nowSeconds) return null;
    if (payload.exp <= payload.iat || payload.exp - payload.iat > MAX_GRANT_SECONDS) return null;
    return payload;
  } catch {
    return null;
  }
}

function securityHeaders(contentType) {
  return {
    "Content-Type": contentType,
    "Cache-Control": "no-store, max-age=0",
    "Content-Security-Policy": "default-src 'none'; script-src 'self'; style-src 'self'; connect-src 'self'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'; upgrade-insecure-requests",
    "Strict-Transport-Security": "max-age=31536000; includeSubDomains",
    "X-Content-Type-Options": "nosniff",
    "Referrer-Policy": "no-referrer",
    "Permissions-Policy": "camera=(), microphone=(), geolocation=(), payment=(), usb=()",
    "Cross-Origin-Opener-Policy": "same-origin",
    "Cross-Origin-Resource-Policy": "same-origin",
    "X-Frame-Options": "DENY",
    "X-Robots-Tag": "noindex, nofollow, noarchive",
  };
}

function json(payload, status = 200) {
  return new Response(JSON.stringify(payload), { status, headers: securityHeaders("application/json; charset=utf-8") });
}

function sameOrigin(request) {
  const origin = request.headers.get("origin");
  return origin === `https://${PLAN_B_HOST}`;
}

function defaultMonitorState() {
  return {
    version: 1,
    state: "healthy",
    incidentId: "",
    consecutiveFailures: 0,
    consecutiveSuccesses: 0,
    canonicalHealthy: null,
    originHealthy: null,
    lastCheckedAt: "",
    outageStartedAt: "",
    recoveryStartedAt: "",
  };
}

async function readMonitorState(env) {
  if (!env?.STATE) return null;
  try {
    const object = await env.STATE.get(MONITOR_STATE_KEY);
    if (!object) return defaultMonitorState();
    const parsed = JSON.parse(await object.text());
    if (parsed?.version !== 1 || typeof parsed.state !== "string") return defaultMonitorState();
    return { ...defaultMonitorState(), ...parsed };
  } catch {
    return defaultMonitorState();
  }
}

async function writeMonitorState(env, state) {
  if (!env?.STATE) throw new Error("state_store_not_ready");
  await env.STATE.put(MONITOR_STATE_KEY, JSON.stringify(state), {
    httpMetadata: { contentType: "application/json" },
  });
}

async function probeHealth(url, fetchImpl) {
  try {
    const response = await fetchImpl(url, {
      method: "GET",
      headers: { "Accept": "application/json", "Cache-Control": "no-cache" },
      signal: AbortSignal.timeout(8000),
    });
    if (!response.ok) return false;
    const body = await response.json().catch(() => null);
    return body?.ok === true && body?.service === "navixa-primary";
  } catch {
    return false;
  }
}

export async function runIndependentMonitor(env, options = {}) {
  if (!env?.STATE) return { ok: false, error: "state_store_not_ready" };
  const now = options.now instanceof Date ? options.now : new Date();
  const fetchImpl = options.fetchImpl || fetch;
  const previous = await readMonitorState(env) || defaultMonitorState();
  const [canonicalHealthy, originHealthy] = await Promise.all([
    probeHealth(PRIMARY_HEALTH_URL, fetchImpl),
    probeHealth(PRIMARY_ORIGIN_HEALTH_URL, fetchImpl),
  ]);

  const next = { ...previous, canonicalHealthy, originHealthy, lastCheckedAt: now.toISOString() };
  if (canonicalHealthy) {
    next.consecutiveFailures = 0;
    next.consecutiveSuccesses = Number(previous.consecutiveSuccesses || 0) + 1;
    if (previous.state === "outage" && next.consecutiveSuccesses >= RECOVERY_THRESHOLD) {
      next.state = "recovery";
      next.recoveryStartedAt = now.toISOString();
    } else if (previous.state === "recovery") {
      next.state = "healthy";
      next.incidentId = "";
      next.outageStartedAt = "";
      next.recoveryStartedAt = "";
      next.consecutiveSuccesses = 0;
    } else if (previous.state === "degraded" && next.consecutiveSuccesses >= RECOVERY_THRESHOLD) {
      next.state = "healthy";
      next.incidentId = "";
      next.consecutiveSuccesses = 0;
    }
  } else {
    next.consecutiveSuccesses = 0;
    next.consecutiveFailures = Number(previous.consecutiveFailures || 0) + 1;
    if (next.consecutiveFailures >= FAILURE_THRESHOLD) {
      if (previous.state !== "outage") {
        next.incidentId = previous.incidentId || crypto.randomUUID();
        next.outageStartedAt = now.toISOString();
      }
      next.state = "outage";
      next.recoveryStartedAt = "";
    } else if (previous.state === "healthy") {
      next.state = "degraded";
      next.incidentId = previous.incidentId || crypto.randomUUID();
    }
  }

  await writeMonitorState(env, next);
  return { ok: true, ...next };
}

export async function handlePlanBRequest(request, env) {
  const url = new URL(request.url);
  if (url.hostname !== PLAN_B_HOST && !url.hostname.endsWith(".workers.dev")) return new Response("Not found", { status: 404 });

  if (url.pathname === "/healthz") {
    return json({
      ok: true,
      service: "navixa-plan-b",
      mode: "standby",
      verifierReady: Boolean(env?.NAVIXA_PLAN_B_SIGNING_SECRET?.length >= 32),
      stateStoreReady: Boolean(env?.STATE),
    });
  }

  if (url.pathname === "/monitor/status") {
    const state = await readMonitorState(env);
    if (!state) return json({ ok: false, error: "state_store_not_ready" }, 503);
    return json({
      ok: true,
      state: state.state,
      lastCheckedAt: state.lastCheckedAt,
      canonicalHealthy: state.canonicalHealthy,
      originHealthy: state.originHealthy,
    });
  }

  if (url.pathname === "/api/verify") {
    if (request.method !== "POST") return json({ ok: false, error: "method_not_allowed" }, 405);
    if (!sameOrigin(request)) return json({ ok: false, error: "origin_rejected" }, 403);
    if (!env?.NAVIXA_PLAN_B_SIGNING_SECRET || env.NAVIXA_PLAN_B_SIGNING_SECRET.length < 32) return json({ ok: false, error: "verifier_not_ready" }, 503);
    const length = Number(request.headers.get("content-length") || "0");
    if (Number.isFinite(length) && length > 8192) return json({ ok: false, error: "payload_too_large" }, 413);
    const raw = await request.text();
    if (raw.length > 8192) return json({ ok: false, error: "payload_too_large" }, 413);
    let token = "";
    try { token = JSON.parse(raw)?.token || ""; } catch { return json({ ok: false, error: "invalid_json" }, 400); }
    const payload = await verifyPlanBGrantToken(token, env.NAVIXA_PLAN_B_SIGNING_SECRET);
    if (!payload) return json({ ok: false, error: "invalid_or_expired_grant" }, 401);
    return json({ ok: true, incident: payload.incident, expiresAt: new Date(payload.exp * 1000).toISOString() });
  }

  if (request.method !== "GET" && request.method !== "HEAD") return new Response("Method not allowed", { status: 405, headers: securityHeaders("text/plain; charset=utf-8") });
  if (url.pathname === "/app.js") return new Response(request.method === "HEAD" ? null : js, { headers: securityHeaders("text/javascript; charset=utf-8") });
  if (url.pathname === "/styles.css") return new Response(request.method === "HEAD" ? null : css, { headers: securityHeaders("text/css; charset=utf-8") });
  if (url.pathname === "/" || url.pathname === "/access") return new Response(request.method === "HEAD" ? null : html, { headers: securityHeaders("text/html; charset=utf-8") });
  return new Response("Not found", { status: 404, headers: securityHeaders("text/plain; charset=utf-8") });
}

export default {
  fetch: handlePlanBRequest,
  async scheduled(_controller, env, ctx) {
    ctx.waitUntil(runIndependentMonitor(env));
  },
};
