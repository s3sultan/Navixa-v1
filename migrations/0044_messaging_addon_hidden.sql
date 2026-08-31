CREATE TABLE IF NOT EXISTS navixa_messaging_settings (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  enabled INTEGER NOT NULL DEFAULT 0,
  public_visible INTEGER NOT NULL DEFAULT 0,
  default_monthly_quota INTEGER NOT NULL DEFAULT 0,
  cooldown_seconds INTEGER NOT NULL DEFAULT 300,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

INSERT OR IGNORE INTO navixa_messaging_settings
  (id, enabled, public_visible, default_monthly_quota, cooldown_seconds)
VALUES (1, 0, 0, 0, 300);

CREATE TABLE IF NOT EXISTS navixa_messaging_allowances (
  subscriber_id TEXT PRIMARY KEY,
  monthly_quota INTEGER NOT NULL DEFAULT 0,
  used_count INTEGER NOT NULL DEFAULT 0,
  period_key TEXT NOT NULL DEFAULT '',
  enabled INTEGER NOT NULL DEFAULT 0,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS navixa_messaging_delivery_guard (
  subscriber_id TEXT NOT NULL,
  event_type TEXT NOT NULL,
  last_sent_at TEXT NOT NULL,
  PRIMARY KEY (subscriber_id, event_type)
);

CREATE INDEX IF NOT EXISTS idx_navixa_messaging_allowances_period
  ON navixa_messaging_allowances(period_key, enabled);
