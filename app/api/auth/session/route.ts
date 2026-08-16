import { NextResponse } from "next/server";
import { deleteAdminSession, readAdminSession } from "../sessionStore";

const ADMIN_EMAIL = "s2shug@gmail.com";

function getCookie(request: Request, name: string) {
  const raw = request.headers.get("cookie") || "";
  const match = raw.match(new RegExp(`(?:^|;\\s*)${name}=([^;]+)`));
  return match ? decodeURIComponent(match[1]) : "";
}

function clearSession(response: NextResponse) {
  response.cookies.set("navixa_admin_session", "", {
    httpOnly: true,
    secure: true,
    sameSite: "lax",
    path: "/",
    maxAge: 0,
  });
  return response;
}

function getSessionId(request: Request) {
  return request.headers.get("x-navixa-admin-session") || getCookie(request, "navixa_admin_session");
}

export async function GET(request: Request) {
  const sessionId = getSessionId(request);
  if (!sessionId) {
    return NextResponse.json({ authenticated: false }, { status: 401, headers: { "Cache-Control": "no-store" } });
  }

  try {
    const session = await readAdminSession(sessionId);
    if (!session || session.email !== ADMIN_EMAIL) {
      const response = NextResponse.json({ authenticated: false }, { status: 401, headers: { "Cache-Control": "no-store" } });
      return clearSession(response);
    }
    return NextResponse.json({ authenticated: true, email: ADMIN_EMAIL }, { headers: { "Cache-Control": "no-store" } });
  } catch {
    return NextResponse.json({ authenticated: false, retry: true }, { status: 503, headers: { "Cache-Control": "no-store" } });
  }
}

export async function DELETE(request: Request) {
  const sessionId = getSessionId(request);
  await deleteAdminSession(sessionId);
  const response = NextResponse.json({ ok: true }, { headers: { "Cache-Control": "no-store" } });
  return clearSession(response);
}
