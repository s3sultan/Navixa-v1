export type EmergencyState = "healthy" | "degraded" | "outage" | "security-hold" | "recovery";

type Statement = {
  bind: (...values: unknown[]) => Statement;
  all: <T = Record<string, unknown>>() => Promise<{ results: T[] }>;
  run: () => Promise<unknown>;
};

export type EmergencyDatabase = { prepare: (sql: string) => Statement };

type IncidentRow = {
  id: string;
  state: EmergencyState;
  reason: string;
  source: string;
  started_at: string;
  updated_at: string;
  start_notified_at: string;
  recovery_notified_at: string;
};

let schemaReady: Promise<void> | null = null;

export async function ensureEmergencyModeSchema(db: EmergencyDatabase) {
  if (!schemaReady) {
    schemaReady = (async () => {
      await db.prepare("CREATE TABLE IF NOT EXISTS navixa_emergency_state (singleton INTEGER PRIMARY KEY CHECK(singleton=1),state TEXT NOT NULL,incident_id TEXT NOT NULL,reason TEXT NOT NULL,source TEXT NOT NULL,updated_at TEXT NOT NULL)").run();
      await db.prepare("CREATE TABLE IF NOT EXISTS navixa_emergency_incidents (id TEXT PRIMARY KEY,state TEXT NOT NULL,reason TEXT NOT NULL,source TEXT NOT NULL,started_at TEXT NOT NULL,updated_at TEXT NOT NULL,start_notified_at TEXT NOT NULL DEFAULT '',recovery_notified_at TEXT NOT NULL DEFAULT '')").run();
      await db.prepare("CREATE TABLE IF NOT EXISTS navixa_emergency_events (id TEXT PRIMARY KEY,incident_id TEXT NOT NULL,state TEXT NOT NULL,reason TEXT NOT NULL,source TEXT NOT NULL,created_at TEXT NOT NULL)").run();
      await db.prepare("INSERT OR IGNORE INTO navixa_emergency_state(singleton,state,incident_id,reason,source,updated_at) VALUES (1,'healthy','','','system',?)").bind(new Date().toISOString()).run();
    })().catch(error => {
      schemaReady = null;
      throw error;
    });
  }
  await schemaReady;
}

function normalizeReason(value: string) {
  return value.trim().replace(/[\r\n\t]+/g, " ").slice(0, 500);
}

function validState(value: string): value is EmergencyState {
  return ["healthy", "degraded", "outage", "security-hold", "recovery"].includes(value);
}

function transitionAllowed(from: EmergencyState, to: EmergencyState) {
  if (from === to) return true;
  const allowed: Record<EmergencyState, EmergencyState[]> = {
    healthy: ["degraded", "outage", "security-hold"],
    degraded: ["healthy", "outage", "security-hold", "recovery"],
    outage: ["security-hold", "recovery"],
    "security-hold": ["outage", "recovery", "healthy"],
    recovery: ["healthy", "outage", "security-hold"],
  };
  return allowed[from].includes(to);
}

export async function readEmergencyState(db: EmergencyDatabase) {
  await ensureEmergencyModeSchema(db);
  const rows = await db.prepare("SELECT state,incident_id,reason,source,updated_at FROM navixa_emergency_state WHERE singleton=1").all<{ state: EmergencyState; incident_id: string; reason: string; source: string; updated_at: string }>();
  return rows.results[0] || { state: "healthy" as EmergencyState, incident_id: "", reason: "", source: "system", updated_at: "" };
}

export async function setEmergencyState(db: EmergencyDatabase, input: { state: string; reason?: string; source?: string }) {
  if (!validState(input.state)) throw new Error("invalid_state");
  await ensureEmergencyModeSchema(db);
  const current = await readEmergencyState(db);
  if (!transitionAllowed(current.state, input.state)) throw new Error("invalid_transition");

  const now = new Date().toISOString();
  const source = (input.source || "admin").trim().slice(0, 80) || "admin";
  const reason = normalizeReason(input.reason || "");
  const startsIncident = current.state === "healthy" && input.state !== "healthy";
  const incidentId = startsIncident ? crypto.randomUUID() : current.incident_id;

  if (startsIncident) {
    await db.prepare("INSERT INTO navixa_emergency_incidents(id,state,reason,source,started_at,updated_at,start_notified_at,recovery_notified_at) VALUES (?,?,?,?,?,?,?,?)")
      .bind(incidentId, input.state, reason, source, now, now, "", "").run();
  } else if (incidentId) {
    await db.prepare("UPDATE navixa_emergency_incidents SET state=?,reason=?,source=?,updated_at=? WHERE id=?")
      .bind(input.state, reason, source, now, incidentId).run();
  }

  await db.prepare("UPDATE navixa_emergency_state SET state=?,incident_id=?,reason=?,source=?,updated_at=? WHERE singleton=1")
    .bind(input.state, input.state === "healthy" ? "" : incidentId, reason, source, now).run();

  await db.prepare("INSERT INTO navixa_emergency_events(id,incident_id,state,reason,source,created_at) VALUES (?,?,?,?,?,?)")
    .bind(crypto.randomUUID(), incidentId, input.state, reason, source, now).run();

  return readEmergencyState(db);
}

export async function listEmergencyIncidents(db: EmergencyDatabase, limit = 20) {
  await ensureEmergencyModeSchema(db);
  const safeLimit = Math.max(1, Math.min(100, Math.floor(limit)));
  const rows = await db.prepare(`SELECT id,state,reason,source,started_at,updated_at,start_notified_at,recovery_notified_at FROM navixa_emergency_incidents ORDER BY started_at DESC LIMIT ${safeLimit}`).all<IncidentRow>();
  return rows.results;
}

export async function claimIncidentNotification(db: EmergencyDatabase, incidentId: string, kind: "start" | "recovery") {
  await ensureEmergencyModeSchema(db);
  const column = kind === "start" ? "start_notified_at" : "recovery_notified_at";
  const rows = await db.prepare(`SELECT ${column} AS sent_at FROM navixa_emergency_incidents WHERE id=?`).bind(incidentId).all<{ sent_at: string }>();
  if (!rows.results[0] || rows.results[0].sent_at) return false;
  const marker = new Date().toISOString();
  await db.prepare(`UPDATE navixa_emergency_incidents SET ${column}=? WHERE id=? AND ${column}=''`).bind(marker, incidentId).run();
  const verify = await db.prepare(`SELECT ${column} AS sent_at FROM navixa_emergency_incidents WHERE id=?`).bind(incidentId).all<{ sent_at: string }>();
  return verify.results[0]?.sent_at === marker;
}
