import { NextResponse } from "next/server.js";
import { ADMIN_SESSION_COOKIE, readCookie, resolveAdminJwtSecret, verifyAdminSessionToken } from "../../../../worker/adminAuth.ts";

export async function GET(request: Request) {
  const secret = await resolveAdminJwtSecret();
  const session = secret ? await verifyAdminSessionToken(readCookie(request, ADMIN_SESSION_COOKIE), secret) : null;
  return NextResponse.json({ authenticated: Boolean(session) }, { headers: { "Cache-Control": "no-store" } });
}
