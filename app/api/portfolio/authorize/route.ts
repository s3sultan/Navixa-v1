import { NextResponse } from "next/server.js";
import { createPortfolioGrant, portfolioApp, PORTFOLIO_APP_HOMES, PORTFOLIO_APPS, PORTFOLIO_SSO_ENABLED, resolvePortfolioMembership, type PortfolioApp } from "../../../../worker/portfolioAccess.ts";
import type { D1Database } from "../../../../worker/userAuth.ts";

type D1Statement = { bind: (...values: unknown[]) => D1Statement; all: <T = Record<string, unknown>>() => Promise<{ results: T[] }> };
type Database = D1Database & { prepare: (sql: string) => D1Statement };
type WorkerBinding = { env?: { DB?: Database; NAVIXA_PORTFOLIO_PRIVATE_JWK?: string } };

const headers = { "Cache-Control": "private, no-store", "Referrer-Policy": "no-referrer", "Vary": "Cookie" };

async function bindings() {
  try { return (await import("cloudflare:workers") as WorkerBinding).env || {}; }
  catch { return globalThis as { DB?: Database; NAVIXA_PORTFOLIO_PRIVATE_JWK?: string }; }
}

function accountRedirect(request: Request, app: PortfolioApp) {
  const target = new URL("/account", request.url);
  target.searchParams.set("next", `/api/portfolio/authorize?app=${encodeURIComponent(app)}`);
  return NextResponse.redirect(target, { headers });
}

export async function GET(request: Request) {
  const requested = portfolioApp(new URL(request.url).searchParams.get("app"));
  if (!requested) return NextResponse.json({ error: "وجهة NAVIXA غير معروفة" }, { status: 400, headers });
  const env = await bindings();
  if (!env.DB || !env.NAVIXA_PORTFOLIO_PRIVATE_JWK) return NextResponse.json({ error: "منظومة NAVIXA غير جاهزة مؤقتًا" }, { status: 503, headers });
  const membership = await resolvePortfolioMembership(request, env.DB).catch(() => null);
  if (!membership) return accountRedirect(request, requested);
  if (!PORTFOLIO_SSO_ENABLED[requested]) return NextResponse.redirect(new URL(PORTFOLIO_APP_HOMES[requested]), { headers });
  const grant = await createPortfolioGrant({ app: requested, membership, privateKeyJwk: env.NAVIXA_PORTFOLIO_PRIVATE_JWK });
  const destination = new URL(PORTFOLIO_APPS[requested]);
  destination.searchParams.set("grant", grant);
  return NextResponse.redirect(destination, { headers });
}
