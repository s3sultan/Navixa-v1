import { NextResponse } from "next/server.js";
import { resolveUserSession, type D1Database } from "../../../../worker/userAuth.ts";
import { isNavixaPilotEmail } from "../../../config/pilot-user.ts";

type WorkerBinding = { env?: { DB?: D1Database } };

const classes = [
  { code: "101", name: "الفيزياء العامة 1", days: [0, 2], start: "15:00", end: "15:50" },
  { code: "232", name: "البرمجة كائنية التوجه", days: [1, 3], start: "16:00", end: "16:50" },
  { code: "231", name: "مقدمة في تقنية ونظم المعلومات", days: [0, 3], start: "17:00", end: "17:50" },
  { code: "150", name: "الرياضيات المتقطعة", days: [1, 3], start: "18:00", end: "18:50" },
  { code: "233", name: "تنظيم الحاسب", days: [1, 3], start: "19:00", end: "19:50" },
] as const;

async function database(): Promise<D1Database | null> {
  try { return (await import("cloudflare:workers") as WorkerBinding).env?.DB || null; }
  catch { return (globalThis as { DB?: D1Database }).DB || null; }
}

export async function GET(request: Request) {
  const db = await database();
  const headers = { "Cache-Control": "private, no-store", "Vary": "Cookie" };
  if (!db) return NextResponse.json({ enabled: false }, { status: 503, headers });

  try {
    const session = await resolveUserSession(request, db);
    if (!session || !isNavixaPilotEmail(session.email)) {
      return NextResponse.json({ enabled: false }, { status: 403, headers });
    }

    return NextResponse.json({
      enabled: true,
      timezone: "Asia/Riyadh",
      reminders: [60, 30, 10],
      // Regular weekly lectures stop recurring before the university final-exam period begins on 13 Dec 2026.
      recurrenceUntilUtc: "20261212T205959Z",
      classes,
    }, { headers });
  } catch {
    return NextResponse.json({ enabled: false }, { status: 503, headers });
  }
}
