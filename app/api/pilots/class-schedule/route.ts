import { NextResponse } from "next/server.js";
import { resolveUserSession, type D1Database } from "../../../../worker/userAuth.ts";
import { isNavixaPilotEmail } from "../../../config/pilot-user.ts";
import {
  CLASS_SCHEDULE_CLASSES,
  CLASS_SCHEDULE_RECURRENCE_UNTIL_UTC,
  CLASS_SCHEDULE_REMINDERS,
  CLASS_SCHEDULE_TIMEZONE,
} from "../../../config/class-schedule-pilot.ts";

type WorkerBinding = { env?: { DB?: D1Database } };

async function database(): Promise<D1Database | null> {
  try { return (await import("cloudflare:workers") as WorkerBinding).env?.DB || null; }
  catch { return (globalThis as { DB?: D1Database }).DB || null; }
}

export async function GET(request: Request) {
  const db = await database();
  const headers = {
    "Cache-Control": "private, no-store",
    "Vary": "Cookie",
    "X-Robots-Tag": "noindex, nofollow",
  };
  if (!db) return NextResponse.json({ enabled: false }, { status: 503, headers });

  try {
    const session = await resolveUserSession(request, db);
    const isPilot = Boolean(
      session &&
      session.status === "active" &&
      await isNavixaPilotEmail(session.email),
    );
    if (!isPilot) return NextResponse.json({ enabled: false }, { status: 403, headers });

    return NextResponse.json({
      enabled: true,
      timezone: CLASS_SCHEDULE_TIMEZONE,
      reminders: CLASS_SCHEDULE_REMINDERS,
      recurrenceUntilUtc: CLASS_SCHEDULE_RECURRENCE_UNTIL_UTC,
      classes: CLASS_SCHEDULE_CLASSES,
    }, { headers });
  } catch {
    return NextResponse.json({ enabled: false }, { status: 503, headers });
  }
}
