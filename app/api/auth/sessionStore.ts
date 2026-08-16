type D1Result = { meta?: { changes?: number } };
type D1Statement = {
  bind: (...values: unknown[]) => D1Statement;
  run: () => Promise<D1Result>;
  all: <T = Record<string, unknown>>() => Promise<{ results: T[] }>;
};
type D1Database = { prepare: (sql: string) => D1Statement };

type StoredSession = { email: string; expires_at: number };

async function getDb(): Promise<D1Database | null> {
  let bound: D1Database | null = null;
  try {
    bound = (await import("cloudflare:workers") as { env?: { DB?: D1Database } }).env?.DB || null;
  } catch {}
  return bound || (globalThis as { DB?: D1Database }).DB || null;
}

async function ensureSchema(db: D1Database) {
  await db.prepare("CREATE TABLE IF NOT EXISTS navixa_admin_sessions (session_id TEXT PRIMARY KEY, email TEXT NOT NULL, expires_at INTEGER NOT NULL, created_at TEXT NOT NULL)").run();
}

export async function createAdminSession(email: string) {
  const db = await getDb();
  if (!db) throw new Error("session-store-unavailable");

  await ensureSchema(db);
  const now = Date.now();
  const sessionId = crypto.randomUUID();
  const expiresAt = now + 12 * 60 * 60 * 1000;

  await db.prepare("DELETE FROM navixa_admin_sessions WHERE expires_at <= ?").bind(now).run();
  await db.prepare("INSERT INTO navixa_admin_sessions (session_id,email,expires_at,created_at) VALUES (?,?,?,?)")
    .bind(sessionId, email, expiresAt, new Date(now).toISOString())
    .run();

  return { sessionId, expiresAt };
}

export async function readAdminSession(sessionId: string): Promise<StoredSession | null> {
  if (!sessionId) return null;
  const db = await getDb();
  if (!db) throw new Error("session-store-unavailable");

  await ensureSchema(db);
  const now = Date.now();
  const result = await db.prepare("SELECT email,expires_at FROM navixa_admin_sessions WHERE session_id = ? LIMIT 1")
    .bind(sessionId)
    .all<StoredSession>();
  const session = result.results[0];

  if (!session) return null;
  if (Number(session.expires_at) <= now) {
    await db.prepare("DELETE FROM navixa_admin_sessions WHERE session_id = ?").bind(sessionId).run();
    return null;
  }

  return { email: String(session.email).toLowerCase(), expires_at: Number(session.expires_at) };
}

export async function deleteAdminSession(sessionId: string) {
  const db = await getDb();
  if (!db || !sessionId) return;
  await ensureSchema(db);
  await db.prepare("DELETE FROM navixa_admin_sessions WHERE session_id = ?").bind(sessionId).run();
}
