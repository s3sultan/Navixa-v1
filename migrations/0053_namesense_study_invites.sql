CREATE TABLE IF NOT EXISTS navixa_namesense_study_invites (
  invite_id TEXT PRIMARY KEY,
  token_hash TEXT NOT NULL UNIQUE,
  speaker_id TEXT NOT NULL UNIQUE,
  accent TEXT NOT NULL,
  max_trials INTEGER NOT NULL CHECK(max_trials BETWEEN 1 AND 100),
  used_trials INTEGER NOT NULL DEFAULT 0 CHECK(used_trials >= 0),
  expires_at TEXT NOT NULL,
  revoked INTEGER NOT NULL DEFAULT 0 CHECK(revoked IN (0,1)),
  created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_namesense_study_invites_active
  ON navixa_namesense_study_invites(revoked, expires_at, accent);
