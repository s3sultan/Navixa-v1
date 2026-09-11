PRAGMA foreign_keys = ON;

-- Persistent automation history stores operational metadata only.
-- Never store automation input/output, transcript text, summaries, credentials,
-- stack traces, or arbitrary metadata in this table.
CREATE TABLE IF NOT EXISTS navixa_automation_runs (
  user_id TEXT NOT NULL,
  id TEXT NOT NULL,
  automation_id TEXT NOT NULL,
  automation_name TEXT NOT NULL,
  skill_id TEXT NOT NULL,
  trigger_type TEXT NOT NULL CHECK (trigger_type IN ('manual','schedule','event')),
  trigger_value TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL CHECK (status IN ('queued','running','succeeded','failed','skipped','cancelled')),
  started_at TEXT NOT NULL,
  completed_at TEXT NOT NULL DEFAULT '',
  session_ref TEXT NOT NULL DEFAULT '',
  part_ref TEXT NOT NULL DEFAULT '',
  source TEXT NOT NULL DEFAULT '' CHECK (source IN ('','transcription','manual','test')),
  persisted_at TEXT NOT NULL,
  PRIMARY KEY (user_id, id),
  FOREIGN KEY (user_id) REFERENCES navixa_users(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_navixa_automation_runs_user_started
  ON navixa_automation_runs(user_id, started_at DESC);

CREATE INDEX IF NOT EXISTS idx_navixa_automation_runs_user_skill_started
  ON navixa_automation_runs(user_id, skill_id, started_at DESC);
