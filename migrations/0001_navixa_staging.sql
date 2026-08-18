-- NAVIXA staging baseline schema.
-- Apply only to the staging D1 database.

CREATE TABLE IF NOT EXISTS navixa_counters (
  key TEXT PRIMARY KEY,
  value INTEGER NOT NULL DEFAULT 0,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS navixa_counter_events (
  event_key TEXT PRIMARY KEY,
  event_name TEXT NOT NULL,
  visitor_key TEXT NOT NULL,
  event_day TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS navixa_sync (
  sync_id TEXT PRIMARY KEY,
  payload TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

INSERT OR IGNORE INTO navixa_counters (key, value, updated_at)
VALUES ('site_visits', 0, CURRENT_TIMESTAMP), ('ehsan_clicks', 0, CURRENT_TIMESTAMP);

CREATE INDEX IF NOT EXISTS idx_navixa_counter_events_day
  ON navixa_counter_events(event_day);

CREATE INDEX IF NOT EXISTS idx_navixa_sync_updated_at
  ON navixa_sync(updated_at);
