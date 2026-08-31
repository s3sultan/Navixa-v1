import type { PremiumMessageEvent } from "./messagingPolicy";

type D1Statement = {
  bind: (...values: unknown[]) => D1Statement;
  all: <T = Record<string, unknown>>() => Promise<{ results: T[] }>;
  run: () => Promise<unknown>;
};
export type MessagingQuotaDb = { prepare: (sql: string) => D1Statement };

type SettingsRow = { enabled: number; cooldown_seconds: number };
type AllowanceRow = { monthly_quota: number; used_count: number; period_key: string; enabled: number };
type GuardRow = { last_sent_at: string };

const meteredEvents = new Set<PremiumMessageEvent>(["name_heard", "screen_watch"]);
const criticalEvents = new Set<PremiumMessageEvent>(["security", "billing", "otp"]);

export function isPremiumMessagingEvent(value: unknown): value is PremiumMessageEvent {
  return value === "name_heard" || value === "screen_watch" || value === "security" || value === "billing" || value === "otp";
}

export function requiresMessagingAllowance(event: PremiumMessageEvent) {
  return meteredEvents.has(event);
}

export function isCriticalMessagingEvent(event: PremiumMessageEvent) {
  return criticalEvents.has(event);
}

function periodKey(date = new Date()) {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Riyadh", year: "numeric", month: "2-digit" }).format(date).slice(0, 7);
}

export async function reservePremiumMessage(db: MessagingQuotaDb, subscriberId: string, event: PremiumMessageEvent) {
  if (isCriticalMessagingEvent(event)) return { allowed: true, reason: "critical" } as const;
  if (!requiresMessagingAllowance(event)) return { allowed: false, reason: "event_not_allowed" } as const;

  const settings = await db.prepare("SELECT enabled,cooldown_seconds FROM navixa_messaging_settings WHERE id=1 LIMIT 1").all<SettingsRow>();
  const global = settings.results[0];
  if (!global?.enabled) return { allowed: false, reason: "messaging_disabled" } as const;

  const currentPeriod = periodKey();
  const allowanceResult = await db.prepare("SELECT monthly_quota,used_count,period_key,enabled FROM navixa_messaging_allowances WHERE subscriber_id=? LIMIT 1").bind(subscriberId).all<AllowanceRow>();
  const allowance = allowanceResult.results[0];
  if (!allowance?.enabled || allowance.monthly_quota <= 0) return { allowed: false, reason: "no_messaging_allowance" } as const;

  let used = allowance.used_count;
  if (allowance.period_key !== currentPeriod) {
    used = 0;
    await db.prepare("UPDATE navixa_messaging_allowances SET used_count=0,period_key=?,updated_at=? WHERE subscriber_id=?").bind(currentPeriod, new Date().toISOString(), subscriberId).run();
  }
  if (used >= allowance.monthly_quota) return { allowed: false, reason: "monthly_quota_exhausted" } as const;

  const guardResult = await db.prepare("SELECT last_sent_at FROM navixa_messaging_delivery_guard WHERE subscriber_id=? AND event_type=? LIMIT 1").bind(subscriberId, event).all<GuardRow>();
  const lastSent = Date.parse(guardResult.results[0]?.last_sent_at || "");
  const cooldownMs = Math.max(60, global.cooldown_seconds || 300) * 1000;
  if (Number.isFinite(lastSent) && Date.now() - lastSent < cooldownMs) return { allowed: false, reason: "cooldown" } as const;

  return { allowed: true, reason: "reserved", quota: allowance.monthly_quota, used } as const;
}

export async function commitPremiumMessage(db: MessagingQuotaDb, subscriberId: string, event: PremiumMessageEvent) {
  if (!requiresMessagingAllowance(event)) return;
  const now = new Date().toISOString();
  await db.prepare("UPDATE navixa_messaging_allowances SET used_count=used_count+1,updated_at=? WHERE subscriber_id=? AND enabled=1 AND used_count<monthly_quota").bind(now, subscriberId).run();
  await db.prepare("INSERT INTO navixa_messaging_delivery_guard(subscriber_id,event_type,last_sent_at) VALUES (?,?,?) ON CONFLICT(subscriber_id,event_type) DO UPDATE SET last_sent_at=excluded.last_sent_at").bind(subscriberId, event, now).run();
}
