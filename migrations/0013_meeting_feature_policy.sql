-- سياسة خادمية لواجهة «لخّص اجتماعك» فقط.
-- لا تُخزَّن هنا تسجيلات أو نصوص أو عناوين IP أو أي هوية مستخدم.
CREATE TABLE IF NOT EXISTS navixa_meeting_feature_settings (
  setting_key TEXT PRIMARY KEY,
  setting_value TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

INSERT OR IGNORE INTO navixa_meeting_feature_settings (setting_key, setting_value, updated_at) VALUES
  ('feature_enabled', 'true', datetime('now')),
  ('base_model_enabled', 'true', datetime('now')),
  ('auto_language_enabled', 'true', datetime('now')),
  ('max_file_mb', '250', datetime('now')),
  ('export_pdf_enabled', 'true', datetime('now')),
  ('export_word_enabled', 'true', datetime('now')),
  ('tutorial_enabled', 'true', datetime('now')),
  ('usage_notice_enabled', 'true', datetime('now'));
