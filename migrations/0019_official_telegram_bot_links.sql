-- Official NAVIXA Telegram bot: one private destination per authenticated user.
-- Tokens are stored only as hashes; Telegram identifiers are encrypted by the worker.
CREATE TABLE IF NOT EXISTS navixa_user_telegram_links (
  user_id TEXT PRIMARY KEY,
  telegram_user_hash TEXT NOT NULL UNIQUE,
  chat_id_ciphertext TEXT NOT NULL,
  linked_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  revoked_at TEXT NOT NULL DEFAULT '',
  FOREIGN KEY(user_id) REFERENCES navixa_users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS navixa_user_telegram_link_tokens (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  token_hash TEXT NOT NULL UNIQUE,
  created_at TEXT NOT NULL,
  expires_at TEXT NOT NULL,
  consumed_at TEXT NOT NULL DEFAULT '',
  FOREIGN KEY(user_id) REFERENCES navixa_users(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_navixa_telegram_link_tokens_active
  ON navixa_user_telegram_link_tokens(token_hash, expires_at, consumed_at);

CREATE TABLE IF NOT EXISTS navixa_user_telegram_preferences (
  user_id TEXT NOT NULL,
  notification_type TEXT NOT NULL,
  enabled INTEGER NOT NULL DEFAULT 1 CHECK(enabled IN (0, 1)),
  updated_at TEXT NOT NULL,
  PRIMARY KEY(user_id, notification_type),
  FOREIGN KEY(user_id) REFERENCES navixa_users(id) ON DELETE CASCADE
);

INSERT OR IGNORE INTO navixa_user_auth_settings(setting_key,setting_value,updated_at) VALUES
  ('telegram_bot_enabled','false',datetime('now')),
  ('telegram_background_alerts_enabled','false',datetime('now'));
