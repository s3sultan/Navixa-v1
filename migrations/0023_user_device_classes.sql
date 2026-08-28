-- Enforce at most one active computer session and one active mobile session per NAVIXA account.
PRAGMA foreign_keys = ON;

ALTER TABLE navixa_user_sessions ADD COLUMN device_class TEXT NOT NULL DEFAULT '';

CREATE INDEX IF NOT EXISTS idx_navixa_user_sessions_user_device_active
  ON navixa_user_sessions(user_id, device_class, expires_at, revoked_at);
