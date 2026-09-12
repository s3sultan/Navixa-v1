CREATE TABLE IF NOT EXISTS navixa_user_push_preferences (
  user_id TEXT NOT NULL,
  category TEXT NOT NULL CHECK(category IN ('adhan','schedule')),
  enabled INTEGER NOT NULL DEFAULT 0,
  snoozed_until TEXT NOT NULL DEFAULT '',
  updated_at TEXT NOT NULL,
  PRIMARY KEY(user_id, category)
);

CREATE INDEX IF NOT EXISTS idx_navixa_user_push_preferences_category
  ON navixa_user_push_preferences(category, enabled, snoozed_until);
