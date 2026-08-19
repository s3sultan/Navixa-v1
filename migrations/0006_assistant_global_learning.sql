-- Optional, review-first global learning. Raw conversations and user identity are never stored.
CREATE TABLE IF NOT EXISTS navixa_assistant_learning_contributions (
  id TEXT PRIMARY KEY,
  question_text TEXT NOT NULL,
  response_text TEXT NOT NULL,
  sensitivity TEXT NOT NULL DEFAULT 'standard' CHECK(sensitivity IN ('standard','sensitive')),
  explicit_sensitive_consent INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','approved','rejected')),
  created_at TEXT NOT NULL,
  reviewed_at TEXT NOT NULL DEFAULT ''
);
CREATE INDEX IF NOT EXISTS idx_navixa_assistant_learning_review
  ON navixa_assistant_learning_contributions(status, created_at DESC);

CREATE TABLE IF NOT EXISTS navixa_assistant_global_patterns (
  id TEXT PRIMARY KEY,
  trigger_text TEXT NOT NULL,
  response_text TEXT NOT NULL,
  source_contribution_id TEXT NOT NULL DEFAULT '',
  active INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_navixa_assistant_global_patterns_active
  ON navixa_assistant_global_patterns(active, updated_at DESC);
