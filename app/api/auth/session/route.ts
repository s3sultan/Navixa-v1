import { NextResponse } from "next/server";

const GOOGLE_CLIENT_ID = "876266145464-i4pigjbevro3ki0d0lj0gds6geivecvb.apps.googleusercontent.com";
const ADMIN_EMAIL = "s2shug@gmail.com";

function getCookie(request: Request, name: string) {
  const raw = request.headers.get("cookie") || "";
  const match = raw.match(new RegExp(`(?:^|;\\s*)${name}=([^;]+)`));
  return match ? decodeURIComponent(match[1]) : "";
}

export async function GET(request: Request) {
  const token = getCookie(request, "navixa_google_token");
  if (!token) return NextResponse.json({ authenticated: false }, { status: 401, headers: { "Cache-Control": "no-store" } });
  try {
    const check = await fetch(`https://oauth2.googleapis.com/tokeninfo?id_token=${encodeURIComponent(token)}`, { cache: "no-store" });
    if (!check.ok) throw new Error("invalid-token");
    const profile = await check.json() as { aud?: string; email?: string; email_verified?: string | boolean; iss?: string; sub?: string };
    const verified = profile.email_verified === true || profile.email_verified === "true";
    const validIssuer = profile.iss === "accounts.google.com" || profile.iss === "https://accounts.google.com";
    const valid = profile.aud === GOOGLE_CLIENT_ID && verified && validIssuer && !!profile.sub && profile.email?.toLowerCase() === ADMIN_EMAIL;
    if (!valid) throw new Error("invalid-profile");
    return NextResponse.json({ authenticated: true, email: ADMIN_EMAIL }, { headers: { "Cache-Control": "no-store" } });
  } catch {
    const response = NextResponse.json({ authenticated: false }, { status: 401, headers: { "Cache-Control": "no-store" } });
    response.cookies.set("navixa_google_token", "", { httpOnly: true, secure: true, sameSite: "strict", path: "/", maxAge: 0 });
    return response;
  }
}
