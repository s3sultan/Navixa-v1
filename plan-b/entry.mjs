import { handlePlanBRequest, runIndependentMonitor } from "./worker.mjs";

const STATE_TABLE = "navixa_plan_b_monitor_state";
let schemaReady = null;

async function ensureSchema(db) {
  if (!db?.prepare) throw new Error("state_store_not_ready");
  if (!schemaReady) {
    schemaReady = db.prepare(`
      CREATE TABLE IF NOT EXISTS ${STATE_TABLE} (
        state_key TEXT PRIMARY KEY,
        payload TEXT NOT NULL,
        updated_at TEXT NOT NULL
      )
    `).run().catch((error) => {
      schemaReady = null;
      throw error;
    });
  }
  await schemaReady;
}

export function createD1StateAdapter(db) {
  if (!db?.prepare) return null;
  return {
    async get(key) {
      await ensureSchema(db);
      const row = await db.prepare(
        `SELECT payload FROM ${STATE_TABLE} WHERE state_key = ? LIMIT 1`,
      ).bind(key).first();
      if (!row || typeof row.payload !== "string") return null;
      return { text: async () => row.payload };
    },
    async put(key, value) {
      await ensureSchema(db);
      await db.prepare(`
        INSERT INTO ${STATE_TABLE} (state_key, payload, updated_at)
        VALUES (?, ?, ?)
        ON CONFLICT(state_key) DO UPDATE SET
          payload = excluded.payload,
          updated_at = excluded.updated_at
      `).bind(key, String(value), new Date().toISOString()).run();
    },
  };
}

function withIndependentState(env) {
  const STATE = createD1StateAdapter(env?.STATE_DB);
  return STATE ? { ...env, STATE } : env;
}

export default {
  async fetch(request, env) {
    const isolatedEnv = withIndependentState(env);
    const url = new URL(request.url);
    if (url.pathname === "/monitor/status" && isolatedEnv?.STATE) {
      await runIndependentMonitor(isolatedEnv);
    }
    return handlePlanBRequest(request, isolatedEnv);
  },
  scheduled(_controller, env, ctx) {
    ctx.waitUntil(runIndependentMonitor(withIndependentState(env)));
  },
};
