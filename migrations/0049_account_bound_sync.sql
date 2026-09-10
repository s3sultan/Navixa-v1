PRAGMA foreign_keys = ON;

-- Account-bound cloud sync is separate from the legacy sync-id/key store.
-- Ownership always comes from the authenticated NAVIXA session server-side.
CREATE TABLE IF NOT EXISTS navixa_account_sync (
  user_id TEXT PRIMARY KEY,
  payload TEXT NOT NULL,
  version INTEGER NOT NULL DEFAULT 1 CHECK (version >= 1),
  updated_at TEXT NOT NULL,
  FOREIGN KEY (user_id) REFERENCES navixa_users(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_navixa_account_sync_updated_at
  ON navixa_account_sync(updated_at);
