import { NextResponse } from "next/server";
import { createAdminSession } from "../sessionStore";

const GOOGLE_CLIENT_ID = "876266145464-i4pigjbevro3ki0d0lj0gds6geivecvb.apps.googleusercontent.com";
const ADMIN_EMAIL = "s2shug@gmail.com";

export async function POST(request: Request) {
  try {
    const { credential } = await request.json();
    if (!credential || typeof credential !== "string") {
      return NextResponse.json({ error: "لم يصل تأكيد Google" }, { status: 400 });
    }

    const check = await fetch(`https://oauth2.googleapis.com/tokeninfo?id_token=${encodeURIComponent(credential)}`, { cache: "no-store" });
    if (!check.ok) return NextResponse.json({ error: "تعذر التحقق من حساب Google" }, { status: 401 });

    const profile = await check.json() as { aud?: string; email?: string; email_verified?: string | boolean; iss?: string };
    const verified = profile.email_verified === true || profile.email_verified === "true";
    const validIssuer = profile.iss === "accounts.google.com" || profile.iss === "https://accounts.google.com";
    const email = profile.email?.toLowerCase() || "";

    if (profile.aud !== GOOGLE_CLIENT_ID || !verified || !validIssuer) {
      return NextResponse.json({ error: "حساب Google غير موثّق" }, { status: 401 });
    }
    if (email !== ADMIN_EMAIL) {
      return NextResponse.json({ error: "هذا الحساب غير مخوّل لدخول الإدارة" }, { status: 403 });
    }

    const session = await createAdminSession(email);
    const response = NextResponse.json({ ok: true, sessionId: session.sessionId }, { headers: { "Cache-Control": "no-store" } });
    response.cookies.set("navixa_admin_session", session.sessionId, {
      httpOnly: true,
      secure: true,
      sameSite: "lax",
      path: "/",
      maxAge: 12 * 60 * 60,
    });
    response.cookies.set("navixa_google_token", "", { httpOnly: true, secure: true, sameSite: "lax", path: "/", maxAge: 0 });
    return response;
  } catch (error) {
    const message = error instanceof Error && error.message === "session-store-unavailable"
      ? "تعذر حفظ جلسة الإدارة؛ تحقق من اتصال قاعدة البيانات"
      : "حدث خطأ أثناء إنشاء جلسة الإدارة";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
