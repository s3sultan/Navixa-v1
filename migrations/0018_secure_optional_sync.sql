-- Optional cloud sync is kept separate from legacy payload rows.
-- A sync identifier alone is never enough to retrieve or replace a payload.
CREATE TABLE IF NOT EXISTS navixa_secure_sync (
  sync_id TEXT PRIMARY KEY,
  sync_key_hash TEXT NOT NULL,
  payload TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_navixa_secure_sync_updated_at
  ON navixa_secure_sync(updated_at);
