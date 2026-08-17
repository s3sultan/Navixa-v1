import { NextResponse } from "next/server.js";
import { createAdminSessionToken, isTrustedSameOriginRequest, makeAdminSessionCookie, resolveAdminJwtSecret } from "../../../../worker/adminAuth.ts";
import { verifyAdminGoogleCredential } from "../googleIdentity.ts";

export async function POST(request: Request) {
  if (!isTrustedSameOriginRequest(request)) {
    return NextResponse.json({ error: "مصدر الطلب غير موثوق" }, { status: 403, headers: { "Cache-Control": "no-store" } });
  }
  const body = await request.json().catch(() => ({}));
  const credential = typeof body.credential === "string" ? body.credential : "";
  const verified = await verifyAdminGoogleCredential(credential);

  if (!verified.ok) {
    return NextResponse.json({ error: verified.error }, {
      status: verified.status,
      headers: { "Cache-Control": "no-store" },
    });
  }

  const secret = await resolveAdminJwtSecret();
  if (!secret || secret.length < 32) {
    return NextResponse.json({ error: "خدمة جلسة الإدارة غير مهيأة" }, { status: 503, headers: { "Cache-Control": "no-store" } });
  }

  const token = await createAdminSessionToken(verified.email, secret);
  const response = NextResponse.json({ ok: true }, { headers: { "Cache-Control": "no-store" } });
  response.headers.append("Set-Cookie", makeAdminSessionCookie(token));
  return response;
}
