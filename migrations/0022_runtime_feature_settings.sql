CREATE TABLE IF NOT EXISTS navixa_runtime_feature_settings (
  setting_key TEXT PRIMARY KEY,
  setting_value TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

INSERT OR IGNORE INTO navixa_runtime_feature_settings (setting_key,setting_value,updated_at) VALUES
  ('floating_assistant_enabled','false',CURRENT_TIMESTAMP),
  ('game_ad_enabled','false',CURRENT_TIMESTAMP),
  ('health_nudge_enabled','false',CURRENT_TIMESTAMP),
  ('member_platform_ribbon_enabled','false',CURRENT_TIMESTAMP),
  ('matches_home_enabled','false',CURRENT_TIMESTAMP),
  ('usage_analytics_enabled','false',CURRENT_TIMESTAMP),
  ('public_counter_enabled','false',CURRENT_TIMESTAMP);
