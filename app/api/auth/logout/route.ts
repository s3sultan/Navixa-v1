import { NextResponse } from "next/server";
import { clearAdminSessionCookie, isTrustedSameOriginRequest } from "../../../../worker/adminAuth.ts";

export async function POST(request: Request) {
  if (!isTrustedSameOriginRequest(request)) {
    return NextResponse.json({ error: "مصدر الطلب غير موثوق" }, { status: 403, headers: { "Cache-Control": "no-store" } });
  }
  const response = NextResponse.json({ ok: true }, { headers: { "Cache-Control": "no-store" } });
  response.headers.append("Set-Cookie", clearAdminSessionCookie());
  return response;
}
