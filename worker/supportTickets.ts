export type SupportProduct = "main" | "learning" | "fitness" | "kids";
export type SupportCategory = "account" | "technical" | "learning" | "fitness" | "kids" | "billing" | "privacy" | "suggestion";
export type SupportStatus = "new" | "in_review" | "waiting_user" | "resolved" | "closed";

export const SUPPORT_PRODUCTS: SupportProduct[] = ["main", "learning", "fitness", "kids"];
export const SUPPORT_CATEGORIES: SupportCategory[] = ["account", "technical", "learning", "fitness", "kids", "billing", "privacy", "suggestion"];
export const SUPPORT_STATUSES: SupportStatus[] = ["new", "in_review", "waiting_user", "resolved", "closed"];
export const SUPPORT_CLOSED_RETENTION_DAYS = 90;

export type D1Statement = {
  bind: (...values: unknown[]) => D1Statement;
  all: <T = Record<string, unknown>>() => Promise<{ results: T[] }>;
  run: () => Promise<unknown>;
};
export type D1Database = { prepare: (query: string) => D1Statement };

export type SupportTicketInput = { product: SupportProduct; category: SupportCategory; subject: string; description: string };

const compact = (value: unknown, maximum: number) => typeof value === "string" ? value.replace(/\s+/g, " ").trim().slice(0, maximum) : "";
const multiline = (value: unknown, maximum: number) => typeof value === "string" ? value.replace(/\r\n/g, "\n").trim().slice(0, maximum) : "";

export function containsSensitiveSupportData(value: string) {
  const text = value.toLowerCase();
  const digitRun = value.replace(/[^0-9]/g, "");
  return /(?:(?:sk|pk)_(?:live|test)_[a-z0-9_-]{10,})|(?:(?:api[ _-]?key|secret|password|passcode|otp|token)\s*[:=]\s*\S+)|(?:(?:كلمة\s*المرور|رمز\s*(?:التحقق|التأكيد)|مفتاح\s*(?:api|api\s*key)|سر)\s*[:=]\s*\S+)/i.test(text) || (digitRun.length >= 12 && digitRun.length <= 19);
}

export function parseSupportTicketInput(value: unknown): { ok: true; value: SupportTicketInput } | { ok: false; error: string } {
  const body = value && typeof value === "object" ? value as Record<string, unknown> : {};
  const product = compact(body.product, 16) as SupportProduct;
  const category = compact(body.category, 24) as SupportCategory;
  const subject = compact(body.subject, 120);
  const description = multiline(body.description, 1600);
  if (!SUPPORT_PRODUCTS.includes(product)) return { ok: false, error: "اختر منصة NAVIXA صحيحة" };
  if (!SUPPORT_CATEGORIES.includes(category)) return { ok: false, error: "اختر تصنيف دعم صحيحًا" };
  if (subject.length < 4 || description.length < 12) return { ok: false, error: "اكتب عنوانًا ووصفًا مختصرين وواضحين" };
  if (containsSensitiveSupportData(`${subject}\n${description}`)) return { ok: false, error: "لا تضع كلمات مرور أو رموز تحقق أو مفاتيح أو بيانات بطاقات في تذكرة الدعم" };
  return { ok: true, value: { product, category, subject, description } };
}

export function parseSupportStatus(value: unknown): SupportStatus | null {
  const status = compact(value, 24) as SupportStatus;
  return SUPPORT_STATUSES.includes(status) ? status : null;
}

export async function ensureSupportTicketSchema(database: D1Database) {
  await database.prepare("CREATE TABLE IF NOT EXISTS navixa_support_tickets (id TEXT PRIMARY KEY,user_id TEXT NOT NULL,product TEXT NOT NULL,category TEXT NOT NULL,subject TEXT NOT NULL,description TEXT NOT NULL,status TEXT NOT NULL DEFAULT 'new',admin_reply TEXT NOT NULL DEFAULT '',created_at TEXT NOT NULL,updated_at TEXT NOT NULL,closed_at TEXT NOT NULL DEFAULT '')").run();
  await database.prepare("CREATE INDEX IF NOT EXISTS idx_navixa_support_user_created ON navixa_support_tickets(user_id,created_at DESC)").run();
  await database.prepare("CREATE INDEX IF NOT EXISTS idx_navixa_support_status_updated ON navixa_support_tickets(status,updated_at DESC)").run();
}

export async function pruneClosedSupportTickets(database: D1Database, now = new Date()) {
  await ensureSupportTicketSchema(database);
  const cutoff = new Date(now.getTime() - SUPPORT_CLOSED_RETENTION_DAYS * 24 * 60 * 60_000).toISOString();
  await database.prepare("DELETE FROM navixa_support_tickets WHERE status='closed' AND closed_at<>'' AND closed_at<?").bind(cutoff).run();
}
