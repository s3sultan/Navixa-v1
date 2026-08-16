export const GOOGLE_CLIENT_ID = "876266145464-i4pigjbevro3ki0d0lj0gds6geivecvb.apps.googleusercontent.com";
export const ADMIN_EMAIL = "s2shug@gmail.com";

type GoogleProfile = {
  aud?: string;
  email?: string;
  email_verified?: string | boolean;
  iss?: string;
  exp?: string;
};

export async function verifyAdminGoogleCredential(credential: string) {
  if (!credential || typeof credential !== "string") return { ok: false as const, status: 400, error: "لم يصل تأكيد Google" };

  try {
    const check = await fetch(`https://oauth2.googleapis.com/tokeninfo?id_token=${encodeURIComponent(credential)}`, { cache: "no-store" });
    if (!check.ok) return { ok: false as const, status: 401, error: "انتهت صلاحية تأكيد Google أو تعذر التحقق منه" };

    const profile = await check.json() as GoogleProfile;
    const verified = profile.email_verified === true || profile.email_verified === "true";
    const validIssuer = profile.iss === "accounts.google.com" || profile.iss === "https://accounts.google.com";
    const email = profile.email?.toLowerCase() || "";

    if (profile.aud !== GOOGLE_CLIENT_ID || !verified || !validIssuer) {
      return { ok: false as const, status: 401, error: "تأكيد Google غير صالح لهذا الموقع" };
    }
    if (email !== ADMIN_EMAIL) {
      return { ok: false as const, status: 403, error: "هذا الحساب غير مخوّل لدخول الإدارة" };
    }

    return { ok: true as const, email };
  } catch {
    return { ok: false as const, status: 503, error: "تعذر الاتصال بخدمة تحقق Google" };
  }
}
