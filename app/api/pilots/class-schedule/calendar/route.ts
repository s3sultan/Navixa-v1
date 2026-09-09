import { resolveUserSession, type D1Database } from "../../../../../worker/userAuth.ts";
import { isNavixaPilotEmail } from "../../../../config/pilot-user.ts";
import {
  CLASS_SCHEDULE_CLASSES,
  CLASS_SCHEDULE_LAST_LECTURE_DATE,
  CLASS_SCHEDULE_RECURRENCE_UNTIL_UTC,
  CLASS_SCHEDULE_REMINDERS,
  CLASS_SCHEDULE_TIMEZONE,
  type ClassScheduleItem,
} from "../../../../config/class-schedule-pilot.ts";

type WorkerBinding = { env?: { DB?: D1Database } };
type RiyadhNow = { year: number; month: number; day: number; hour: number; minute: number };
type CalendarDate = { year: number; month: number; day: number };

const pad = (value: number) => String(value).padStart(2, "0");
const dateKey = ({ year, month, day }: CalendarDate) => `${year}-${pad(month)}-${pad(day)}`;
const localStamp = (date: CalendarDate, time: string) => `${date.year}${pad(date.month)}${pad(date.day)}T${time.replace(":", "")}00`;
const utcStamp = (date: Date) => `${date.getUTCFullYear()}${pad(date.getUTCMonth() + 1)}${pad(date.getUTCDate())}T${pad(date.getUTCHours())}${pad(date.getUTCMinutes())}${pad(date.getUTCSeconds())}Z`;
const escapeIcs = (value: string) => value.replace(/\\/g, "\\\\").replace(/\n/g, "\\n").replace(/;/g, "\\;").replace(/,/g, "\\,");

function riyadhNow(now = new Date()): RiyadhNow {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: CLASS_SCHEDULE_TIMEZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(now);
  const get = (type: Intl.DateTimeFormatPartTypes) => Number(parts.find(part => part.type === type)?.value || 0);
  return { year: get("year"), month: get("month"), day: get("day"), hour: get("hour"), minute: get("minute") };
}

function addDays(base: CalendarDate, offset: number): CalendarDate {
  const date = new Date(Date.UTC(base.year, base.month - 1, base.day + offset));
  return { year: date.getUTCFullYear(), month: date.getUTCMonth() + 1, day: date.getUTCDate() };
}

function weekday(date: CalendarDate) {
  return new Date(Date.UTC(date.year, date.month - 1, date.day)).getUTCDay();
}

function nextDateForDay(day: number, current: RiyadhNow, startTime: string): CalendarDate | null {
  const currentMinutes = current.hour * 60 + current.minute;
  const [startHour, startMinute] = startTime.split(":").map(Number);
  const startMinutes = startHour * 60 + startMinute;
  const base = { year: current.year, month: current.month, day: current.day };
  for (let offset = 0; offset <= 7; offset += 1) {
    const candidate = addDays(base, offset);
    if (weekday(candidate) !== day) continue;
    if (offset === 0 && startMinutes <= currentMinutes) continue;
    if (dateKey(candidate) > CLASS_SCHEDULE_LAST_LECTURE_DATE) return null;
    return candidate;
  }
  return null;
}

function eventLines(item: ClassScheduleItem, day: number, startDate: CalendarDate, dtstamp: string) {
  const alarms = CLASS_SCHEDULE_REMINDERS.flatMap(minutes => [
    "BEGIN:VALARM",
    `TRIGGER:-PT${minutes}M`,
    "ACTION:DISPLAY",
    `DESCRIPTION:${escapeIcs(`باقي ${minutes} دقيقة على ${item.name}`)}`,
    "END:VALARM",
  ]);
  return [
    "BEGIN:VEVENT",
    `UID:navixa-class-${item.code}-${day}@navixasa.com`,
    `DTSTAMP:${dtstamp}`,
    `DTSTART;TZID=${CLASS_SCHEDULE_TIMEZONE}:${localStamp(startDate, item.start)}`,
    `DTEND;TZID=${CLASS_SCHEDULE_TIMEZONE}:${localStamp(startDate, item.end)}`,
    `RRULE:FREQ=WEEKLY;UNTIL=${CLASS_SCHEDULE_RECURRENCE_UNTIL_UTC}`,
    `SUMMARY:${escapeIcs(`${item.name} (${item.code})`)}`,
    `DESCRIPTION:${escapeIcs("محاضرة عن بُعد - NAVIXA")}`,
    "STATUS:CONFIRMED",
    "TRANSP:OPAQUE",
    ...alarms,
    "END:VEVENT",
  ];
}

async function database(): Promise<D1Database | null> {
  try { return (await import("cloudflare:workers") as WorkerBinding).env?.DB || null; }
  catch { return (globalThis as { DB?: D1Database }).DB || null; }
}

export async function GET(request: Request) {
  const db = await database();
  const baseHeaders = {
    "Cache-Control": "private, no-store",
    "Vary": "Cookie",
    "X-Robots-Tag": "noindex, nofollow",
  };
  if (!db) return new Response("Unavailable", { status: 503, headers: baseHeaders });

  try {
    const session = await resolveUserSession(request, db);
    const isPilot = Boolean(
      session &&
      session.status === "active" &&
      await isNavixaPilotEmail(session.email),
    );
    if (!isPilot) return new Response("Forbidden", { status: 403, headers: baseHeaders });

    const current = riyadhNow();
    const dtstamp = utcStamp(new Date());
    const events = CLASS_SCHEDULE_CLASSES.flatMap(item => item.days.flatMap(day => {
      const startDate = nextDateForDay(day, current, item.start);
      return startDate ? eventLines(item, day, startDate, dtstamp) : [];
    }));

    if (!events.length) return new Response("No future lectures", { status: 410, headers: baseHeaders });

    const calendar = [
      "BEGIN:VCALENDAR",
      "VERSION:2.0",
      "PRODID:-//NAVIXA//Private Class Schedule//AR",
      "CALSCALE:GREGORIAN",
      "METHOD:PUBLISH",
      "X-WR-CALNAME:NAVIXA - جدولي",
      `X-WR-TIMEZONE:${CLASS_SCHEDULE_TIMEZONE}`,
      "BEGIN:VTIMEZONE",
      `TZID:${CLASS_SCHEDULE_TIMEZONE}`,
      `X-LIC-LOCATION:${CLASS_SCHEDULE_TIMEZONE}`,
      "BEGIN:STANDARD",
      "TZOFFSETFROM:+0300",
      "TZOFFSETTO:+0300",
      "TZNAME:+03",
      "DTSTART:19700101T000000",
      "END:STANDARD",
      "END:VTIMEZONE",
      ...events,
      "END:VCALENDAR",
      "",
    ].join("\r\n");

    return new Response(calendar, {
      headers: {
        ...baseHeaders,
        "Content-Type": "text/calendar; charset=utf-8",
        "Content-Disposition": "attachment; filename=\"NAVIXA-class-schedule-2026.ics\"",
      },
    });
  } catch {
    return new Response("Unavailable", { status: 503, headers: baseHeaders });
  }
}
