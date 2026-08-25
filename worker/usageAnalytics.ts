export type UsageAnalyticsDatabase = { prepare: (sql: string) => { bind: (...values: unknown[]) => { run: () => Promise<unknown> } } };

let schemaReady: Promise<void> | null = null;

export async function ensureUsageAnalyticsSchema(db: UsageAnalyticsDatabase) {
  if (!schemaReady) {
    schemaReady = (async () => {
      await db.prepare("CREATE TABLE IF NOT EXISTS navixa_usage_events (id TEXT PRIMARY KEY,user_id TEXT NOT NULL,path TEXT NOT NULL,event_type TEXT NOT NULL,grid_x INTEGER NOT NULL DEFAULT -1,grid_y INTEGER NOT NULL DEFAULT -1,duration_seconds INTEGER NOT NULL DEFAULT 0,created_at TEXT NOT NULL)").bind().run();
      await db.prepare("CREATE INDEX IF NOT EXISTS idx_navixa_usage_events_user_created ON navixa_usage_events(user_id,created_at)").bind().run();
      await db.prepare("CREATE INDEX IF NOT EXISTS idx_navixa_usage_events_path_created ON navixa_usage_events(path,created_at)").bind().run();
    })().catch(error => { schemaReady = null; throw error; });
  }
  await schemaReady;
}

export async function pruneUsageAnalytics(env: { DB: UsageAnalyticsDatabase }) {
  await ensureUsageAnalyticsSchema(env.DB);
  const cutoff = new Date(Date.now() - 30 * 24 * 60 * 60_000).toISOString();
  await env.DB.prepare("DELETE FROM navixa_usage_events WHERE created_at < ?").bind(cutoff).run();
}
