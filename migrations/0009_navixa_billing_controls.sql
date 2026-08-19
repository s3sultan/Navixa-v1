CREATE TABLE IF NOT EXISTS navixa_billing_settings (
  setting_key TEXT PRIMARY KEY,
  setting_value TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

INSERT OR IGNORE INTO navixa_billing_settings (setting_key, setting_value, updated_at) VALUES
  ('provider', 'moyasar', datetime('now')),
  ('mode', 'test', datetime('now')),
  ('public_checkout', 'false', datetime('now')),
  ('test_webhook_enabled', 'false', datetime('now')),
  ('live_payments_enabled', 'false', datetime('now'));

CREATE INDEX IF NOT EXISTS idx_navixa_billing_events_mode_created
  ON navixa_billing_events(mode, created_at DESC);
