import { NextResponse } from "next/server.js";
import { resolvePortfolioMembership } from "../../../../worker/portfolioAccess.ts";
import type { D1Database } from "../../../../worker/userAuth.ts";

type D1Statement = { bind: (...values: unknown[]) => D1Statement; all: <T = Record<string, unknown>>() => Promise<{ results: T[] }> };
type Database = D1Database & { prepare: (sql: string) => D1Statement };
type WorkerBinding = { env?: { DB?: Database } };

const ALLOWED_ORIGINS = new Set([
  "https://learning.navixasa.com",
  "https://kids.navixasa.com",
  "https://fitness.navixasa.com",
]);

function responseHeaders(request: Request) {
  const origin = request.headers.get("origin") || "";
  const headers: Record<string, string> = {
    "Cache-Control": "private, no-store",
    "Vary": "Cookie, Origin",
  };
  if (ALLOWED_ORIGINS.has(origin)) {
    headers["Access-Control-Allow-Origin"] = origin;
    headers["Access-Control-Allow-Credentials"] = "true";
  }
  return headers;
}

async function database(): Promise<Database | null> {
  try { return (await import("cloudflare:workers") as WorkerBinding).env?.DB || null; }
  catch { return (globalThis as { DB?: Database }).DB || null; }
}

export async function OPTIONS(request: Request) {
  const origin = request.headers.get("origin") || "";
  if (!ALLOWED_ORIGINS.has(origin)) return new NextResponse(null, { status: 403, headers: { "Cache-Control": "no-store" } });
  return new NextResponse(null, {
    status: 204,
    headers: {
      ...responseHeaders(request),
      "Access-Control-Allow-Methods": "GET, OPTIONS",
      "Access-Control-Allow-Headers": "Accept",
      "Access-Control-Max-Age": "600",
    },
  });
}

export async function GET(request: Request) {
  const headers = responseHeaders(request);
  const db = await database();
  if (!db) return NextResponse.json({ eligible: false, unavailable: true }, { status: 503, headers });
  const membership = await resolvePortfolioMembership(request, db).catch(() => null);
  if (!membership) return NextResponse.json({ eligible: false }, { headers });
  return NextResponse.json({ eligible: true, status: membership.status, plan: membership.plan, endsAt: membership.endsAt }, { headers });
}
