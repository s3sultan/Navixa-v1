import { NextResponse } from "next/server.js";
import { resolvePortfolioMembership } from "../../../../worker/portfolioAccess.ts";
import { getUserAuthSettings, refreshUserSessionIfNeeded, resolveUserSession, type D1Database } from "../../../../worker/userAuth.ts";

type D1Statement = { bind: (...values: unknown[]) => D1Statement; all: <T = Record<string, unknown>>() => Promise<{ results: T[] }> };
type Database = D1Database & { prepare: (sql: string) => D1Statement };
type WorkerBinding = { env?: { DB?: Database } };

async function database(): Promise<Database | null> {
  try { return (await import("cloudflare:workers") as WorkerBinding).env?.DB || null; }
  catch { return (globalThis as { DB?: D1Database }).DB || null; }
}

export async function GET(request: Request) {
  const db = await database();
  if (!db) return NextResponse.json({ enabled: false, signedIn: false, message: "حسابات NAVIXA غير متاحة مؤقتًا" }, { status: 503, headers: { "Cache-Control": "no-store" } });
  try {
    const [settings, resolvedSession] = await Promise.all([getUserAuthSettings(db), resolveUserSession(request, db)]);
    if (!settings.userAuthEnabled) return NextResponse.json({ enabled: false, signedIn: false, trialDays: settings.trialDays }, { headers: { "Cache-Control": "no-store" } });
    const refreshed = resolvedSession ? await refreshUserSessionIfNeeded(request, db, resolvedSession).catch(() => ({ session: resolvedSession, cookie: null })) : { session: null, cookie: null };
    const session = refreshed.session;
    const headers: Record<string, string> = { "Cache-Control": "private, no-store", "Vary": "Cookie" };
    if (refreshed.cookie) headers["Set-Cookie"] = refreshed.cookie;
    const membership = session ? await resolvePortfolioMembership(request, db).catch(() => null) : null;
    return NextResponse.json({
      enabled: true,
      signedIn: Boolean(session),
      trialDays: settings.trialDays,
      googleLoginEnabled: settings.userAuthEnabled,
      passkeysEnabled: settings.passkeysEnabled,
      earlyAccessEnabled: settings.earlyAccessEnabled,
      user: session ? { email: session.email, status: session.status, expiresAt: session.expiresAt } : null,
      plus: membership ? {
        plan: membership.plan,
        status: membership.status,
        trial_ends_at: membership.status === "trial" ? membership.endsAt : "",
        subscription_ends_at: membership.status === "active" ? membership.endsAt : "",
        source: membership.source || "owner",
        memberRole: membership.memberRole || null,
      } : null,
    }, { headers });
  } catch {
    return NextResponse.json({ enabled: false, signedIn: false, message: "لم تُهيأ حسابات NAVIXA بعد" }, { status: 503, headers: { "Cache-Control": "no-store" } });
  }
}
