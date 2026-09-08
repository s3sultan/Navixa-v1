export const NAVIXA_MEMORY_SCHEMA_SQL = `
CREATE TABLE IF NOT EXISTS navixa_ai_memory (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  project TEXT NOT NULL,
  kind TEXT NOT NULL,
  content TEXT NOT NULL,
  source TEXT NOT NULL,
  sensitivity TEXT NOT NULL DEFAULT 'standard',
  confidence REAL NOT NULL DEFAULT 0.7,
  salience REAL NOT NULL DEFAULT 0.5,
  metadata_json TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  expires_at TEXT
);
CREATE INDEX IF NOT EXISTS idx_navixa_ai_memory_user_project
  ON navixa_ai_memory(user_id, project, updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_navixa_ai_memory_expiry
  ON navixa_ai_memory(expires_at);
`;

// This schema is intentionally exported only. It must be applied through NAVIXA's
// controlled database release process and is never executed automatically at runtime.
