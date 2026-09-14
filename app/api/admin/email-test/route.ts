import { NextResponse } from "next/server.js";
import { createMemoryRateLimiter } from "../../../../worker/adminAuth.ts";
import { requireAdminPermission } from "../../../../worker/adminAccess.ts";
import { writeAdminActivity, type AdminActivityDatabase } from "../../../../worker/adminActivity.ts";

type Env = Record<string, string | undefined> & { DB?: AdminActivityDatabase };
const limiter = createMemoryRateLimiter();

async function runtimeEnv(): Promise<Env> {
  try { return (await import("cloudflare:workers") as { env?: Env }).env || {}; }
  catch { return globalThis as Env; }
}

async function audit(env:Env,adminEmail:string,outcome:"success"|"failure",metadata?:Record<string,unknown>){
  if(env.DB)await writeAdminActivity(env.DB,{adminEmail,action:"email_test.send",resource:"communications",outcome,metadata});
}

function noStore(body: Record<string, unknown>, status = 200) {
  return NextResponse.json(body, { status, headers: { "Cache-Control": "no-store" } });
}

export async function POST(request: Request) {
  const identity=await requireAdminPermission(request,"communications.test");
  if (!identity) return noStore({ error: "غير مصرح" }, 401);
  const client = request.headers.get("cf-connecting-ip") || request.headers.get("x-forwarded-for") || "admin";
  const quota = limiter.consume(`navixa-admin-email-test:${client}`, 3, 10 * 60_000);
  if (!quota.allowed) return noStore({ error: "تم تجاوز حد اختبارات البريد المؤقت. حاول بعد قليل.", retryAfterSeconds: quota.retryAfterSeconds }, 429);

  const env = await runtimeEnv();
  const from = env.RESEND_FROM_EMAIL || env.NAVIXA_AUTH_FROM;
  const to = env.NAVIXA_ADMIN_EMAIL;
  if (!env.RESEND_API_KEY || !from || !to) {
    await audit(env,identity.email,"failure",{reason:"configuration"});
    return noStore({ error: "بريد NAVIXA غير مكتمل الإعداد" }, 409);
  }

  try {
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${env.RESEND_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        from,
        to: [to],
        subject: "اختبار بريد NAVIXA SA",
        text: "هذه رسالة اختبار إدارية من NAVIXA SA للتأكد من جاهزية الإرسال. لا يلزم اتخاذ أي إجراء.",
      }),
    });
    if (!response.ok) {
      await audit(env,identity.email,"failure",{status:response.status});
      return noStore({ error: "تعذر إرسال اختبار البريد عبر Resend" }, 502);
    }
    await audit(env,identity.email,"success",{channel:"email"});
    return noStore({ ok: true, message: "تم إرسال رسالة الاختبار إلى بريد المدير" });
  } catch {
    await audit(env,identity.email,"failure",{reason:"provider_unreachable"});
    return noStore({ error: "تعذر الاتصال بخدمة البريد الآن" }, 502);
  }
}
