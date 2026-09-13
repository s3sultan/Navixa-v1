export type AdminActivityRow = {
  id: number;
  admin_email: string;
  action: string;
  resource: string;
  outcome: "success" | "failure";
  metadata_json: string | null;
  created_at: string;
};

type AdminActivityStatement = {
  bind: (...values: unknown[]) => AdminActivityStatement;
  all: <T = Record<string, unknown>>() => Promise<{ results: T[] }>;
  run: () => Promise<unknown>;
};
export type AdminActivityDatabase = { prepare: (query: string) => AdminActivityStatement };

const sensitiveKey = /(token|secret|password|authorization|cookie|otp|api.?key|jwt|session)/i;

function safePrimitive(value: unknown) {
  if (typeof value === "string") return value.slice(0, 240);
  if (typeof value === "number" || typeof value === "boolean" || value === null) return value;
  return String(value).slice(0, 240);
}

export function sanitizeAdminMetadata(value: Record<string, unknown> | undefined) {
  if (!value) return null;
  const safe: Record<string, unknown> = {};
  for (const [key, raw] of Object.entries(value).slice(0, 24)) {
    if (sensitiveKey.test(key)) { safe[key] = "[redacted]"; continue; }
    if (Array.isArray(raw)) safe[key] = raw.slice(0, 20).map(safePrimitive);
    else if (raw && typeof raw === "object") {
      const nested: Record<string, unknown> = {};
      for (const [nestedKey, nestedValue] of Object.entries(raw as Record<string, unknown>).slice(0, 12)) {
        nested[nestedKey] = sensitiveKey.test(nestedKey) ? "[redacted]" : safePrimitive(nestedValue);
      }
      safe[key] = nested;
    } else safe[key] = safePrimitive(raw);
  }
  return safe;
}

export async function writeAdminActivity(database: AdminActivityDatabase, entry: {
  adminEmail: string;
  action: string;
  resource: string;
  outcome?: "success" | "failure";
  metadata?: Record<string, unknown>;
}) {
  const metadata = sanitizeAdminMetadata(entry.metadata);
  try {
    await database.prepare("INSERT INTO navixa_admin_activity(admin_email,action,resource,outcome,metadata_json,created_at) VALUES (?,?,?,?,?,?)")
      .bind(entry.adminEmail.toLowerCase(), entry.action.slice(0, 100), entry.resource.slice(0, 100), entry.outcome || "success", metadata ? JSON.stringify(metadata) : null, new Date().toISOString())
      .run();
    return true;
  } catch {
    return false;
  }
}

export async function readAdminActivity(database: AdminActivityDatabase, limit = 50) {
  const safeLimit = Math.max(1, Math.min(100, Math.trunc(limit) || 50));
  const rows = await database.prepare("SELECT id,admin_email,action,resource,outcome,metadata_json,created_at FROM navixa_admin_activity ORDER BY created_at DESC,id DESC LIMIT ?")
    .bind(safeLimit)
    .all<AdminActivityRow>();
  return rows.results;
}
