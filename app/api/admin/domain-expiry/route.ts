import { NextResponse } from "next/server.js";
import { ADMIN_SESSION_COOKIE, isTrustedSameOriginRequest, readCookie, resolveAdminJwtSecret, verifyAdminSessionToken } from "../../../../worker/adminAuth.ts";
import { readDomainExpiryStatus } from "../../../../worker/domainExpiryAlert.ts";

type DomainEnv = Parameters<typeof readDomainExpiryStatus>[0];

async function env(): Promise<DomainEnv> {
  try { return ((await import("cloudflare:workers") as { env?: DomainEnv }).env || {}) as DomainEnv; }
  catch { return globalThis as DomainEnv; }
}

async function allowed(request: Request) {
  const secret = await resolveAdminJwtSecret();
  return Boolean(secret && isTrustedSameOriginRequest(request) && await verifyAdminSessionToken(readCookie(request, ADMIN_SESSION_COOKIE), secret));
}

export async function GET(request: Request) {
  if (!await allowed(request)) return NextResponse.json({ error: "غير مصرح" }, { status: 401, headers: { "Cache-Control": "no-store" } });
  try {
    const status = await readDomainExpiryStatus(await env());
    return NextResponse.json(status, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "تعذر قراءة حالة الدومين" }, { status: 502, headers: { "Cache-Control": "no-store" } });
  }
}
