CREATE TABLE IF NOT EXISTS navixa_prayer_alert_settings (
  user_id TEXT PRIMARY KEY,
  location_mode TEXT NOT NULL DEFAULT 'coords',
  city TEXT NOT NULL DEFAULT '',
  country TEXT NOT NULL DEFAULT '',
  latitude REAL,
  longitude REAL,
  label TEXT NOT NULL DEFAULT '',
  adjustments_json TEXT NOT NULL DEFAULT '{}',
  iqama_json TEXT NOT NULL DEFAULT '{}',
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS navixa_prayer_alert_delivery (
  user_id TEXT NOT NULL,
  event_key TEXT NOT NULL,
  created_at TEXT NOT NULL,
  PRIMARY KEY(user_id,event_key)
);

CREATE INDEX IF NOT EXISTS idx_navixa_prayer_alert_delivery_created
  ON navixa_prayer_alert_delivery(created_at);
