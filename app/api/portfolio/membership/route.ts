import { NextResponse } from "next/server.js";
import { resolvePortfolioMembership } from "../../../../worker/portfolioAccess.ts";
import type { D1Database } from "../../../../worker/userAuth.ts";

type D1Statement = { bind: (...values: unknown[]) => D1Statement; all: <T = Record<string, unknown>>() => Promise<{ results: T[] }> };
type Database = D1Database & { prepare: (sql: string) => D1Statement };
type WorkerBinding = { env?: { DB?: Database } };
const headers = { "Cache-Control": "private, no-store", "Vary": "Cookie" };

async function database(): Promise<Database | null> {
  try { return (await import("cloudflare:workers") as WorkerBinding).env?.DB || null; }
  catch { return (globalThis as { DB?: Database }).DB || null; }
}

export async function GET(request: Request) {
  const db = await database();
  if (!db) return NextResponse.json({ eligible: false, unavailable: true }, { status: 503, headers });
  const membership = await resolvePortfolioMembership(request, db).catch(() => null);
  if (!membership) return NextResponse.json({ eligible: false }, { headers });
  return NextResponse.json({ eligible: true, status: membership.status, plan: membership.plan, endsAt: membership.endsAt }, { headers });
}
