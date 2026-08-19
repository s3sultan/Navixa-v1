-- Privacy-preserving match notifications and presentation controls.
CREATE TABLE IF NOT EXISTS navixa_push_subscriptions (
  id TEXT PRIMARY KEY,
  endpoint TEXT NOT NULL UNIQUE,
  p256dh TEXT NOT NULL,
  auth TEXT NOT NULL,
  competitions_json TEXT NOT NULL DEFAULT '[]',
  teams_json TEXT NOT NULL DEFAULT '[]',
  before_minutes INTEGER NOT NULL DEFAULT 10 CHECK(before_minutes IN (0,5,10,15)),
  enabled INTEGER NOT NULL DEFAULT 1 CHECK(enabled IN (0,1)),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS navixa_push_deliveries (
  subscription_id TEXT NOT NULL,
  fixture_id TEXT NOT NULL,
  before_minutes INTEGER NOT NULL,
  sent_at TEXT NOT NULL,
  PRIMARY KEY(subscription_id, fixture_id, before_minutes)
);

CREATE TABLE IF NOT EXISTS navixa_match_display_settings (
  id INTEGER PRIMARY KEY CHECK(id = 1),
  ribbon_speed_seconds INTEGER NOT NULL DEFAULT 36 CHECK(ribbon_speed_seconds BETWEEN 20 AND 90),
  ribbon_theme TEXT NOT NULL DEFAULT 'teal' CHECK(ribbon_theme IN ('teal','lavender','navy')),
  show_logos INTEGER NOT NULL DEFAULT 1 CHECK(show_logos IN (0,1)),
  updated_at TEXT NOT NULL
);
INSERT OR IGNORE INTO navixa_match_display_settings (id, ribbon_speed_seconds, ribbon_theme, show_logos, updated_at)
  VALUES (1, 36, 'teal', 1, CURRENT_TIMESTAMP);

CREATE TABLE IF NOT EXISTS navixa_match_analytics_daily (
  day TEXT NOT NULL,
  metric TEXT NOT NULL CHECK(metric IN ('ribbon_view','fixture_open','alert_enabled','push_sent')),
  fixture_id TEXT NOT NULL DEFAULT '',
  total INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY(day, metric, fixture_id)
);

CREATE TABLE IF NOT EXISTS navixa_team_aliases (
  source_name TEXT PRIMARY KEY,
  arabic_name TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
