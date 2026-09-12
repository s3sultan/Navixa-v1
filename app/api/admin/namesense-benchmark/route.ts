import { NextResponse } from "next/server.js";
import {
  ADMIN_SESSION_COOKIE,
  isTrustedSameOriginRequest,
  readCookie,
  resolveAdminJwtSecret,
  verifyAdminSessionToken,
} from "../../../../worker/adminAuth.ts";
import {
  ensureNameSenseBenchmarkSchema,
  storeNameSenseBenchmarkTrial,
  type NameSenseDb,
} from "../../../../benchmarks/namesense/storage.ts";
import { validateNameSenseBenchmarkTrial } from "./schema.ts";

async function db(): Promise<NameSenseDb | null> {
  try {
    return (await import("cloudflare:workers") as { env?: { DB?: NameSenseDb } }).env?.DB || null;
  } catch {
    return (globalThis as { DB?: NameSenseDb }).DB || null;
  }
}

async function allowed(request: Request, mutation = false) {
  if (mutation && !isTrustedSameOriginRequest(request)) return false;
  const secret = await resolveAdminJwtSecret();
  return Boolean(secret && await verifyAdminSessionToken(readCookie(request, ADMIN_SESSION_COOKIE), secret));
}

type AccentRow = {
  accent: string;
  trials: number;
  speakers: number;
  positives: number;
  negatives: number;
  tp: number;
  fn: number;
  fp: number;
  tn: number;
};

export async function GET(request: Request) {
  if (!await allowed(request)) {
    return NextResponse.json({ error: "غير مصرح" }, { status: 401, headers: { "Cache-Control": "no-store" } });
  }
  const database = await db();
  if (!database) return NextResponse.json({ configured: false, accents: [] }, { headers: { "Cache-Control": "no-store" } });
  await ensureNameSenseBenchmarkSchema(database);
  const rows = await database.prepare(`
    SELECT
      accent,
      COUNT(*) AS trials,
      COUNT(DISTINCT speaker_id) AS speakers,
      SUM(CASE WHEN expected='hit' THEN 1 ELSE 0 END) AS positives,
      SUM(CASE WHEN expected='miss' THEN 1 ELSE 0 END) AS negatives,
      SUM(CASE WHEN expected='hit' AND detected=1 THEN 1 ELSE 0 END) AS tp,
      SUM(CASE WHEN expected='hit' AND detected=0 THEN 1 ELSE 0 END) AS fn,
      SUM(CASE WHEN expected='miss' AND detected=1 THEN 1 ELSE 0 END) AS fp,
      SUM(CASE WHEN expected='miss' AND detected=0 THEN 1 ELSE 0 END) AS tn
    FROM navixa_namesense_benchmark_trials
    GROUP BY accent
    ORDER BY accent
  `).all<AccentRow>();
  return NextResponse.json(
    { configured: true, accents: rows.results },
    { headers: { "Cache-Control": "private, no-store" } },
  );
}

export async function POST(request: Request) {
  if (!await allowed(request, true)) {
    return NextResponse.json({ error: "غير مصرح" }, { status: 401, headers: { "Cache-Control": "no-store" } });
  }
  const parsed = validateNameSenseBenchmarkTrial(await request.json().catch(() => null));
  if (!parsed.ok) {
    return NextResponse.json({ error: parsed.error }, { status: 400, headers: { "Cache-Control": "no-store" } });
  }
  const database = await db();
  if (!database) return NextResponse.json({ error: "قاعدة البيانات غير مهيأة" }, { status: 503, headers: { "Cache-Control": "no-store" } });

  const stored = await storeNameSenseBenchmarkTrial(database, parsed.trial);
  if (!stored.ok) {
    return NextResponse.json({ error: stored.error }, { status: stored.status, headers: { "Cache-Control": "no-store" } });
  }

  return NextResponse.json({ ok: true, trialId: stored.trialId }, { headers: { "Cache-Control": "private, no-store" } });
}
