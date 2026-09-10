-- Cross-device sync bound to the existing NAVIXA OTP account session.
-- The browser never supplies an account identifier or a separate sync secret.
PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS navixa_user_sync (
  user_id TEXT PRIMARY KEY,
  version INTEGER NOT NULL DEFAULT 1 CHECK(version >= 1),
  payload TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY(user_id) REFERENCES navixa_users(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_navixa_user_sync_updated_at
  ON navixa_user_sync(updated_at);
