CREATE TABLE IF NOT EXISTS navixa_user_telegram_manual (
  user_id TEXT PRIMARY KEY,
  bot_token_ciphertext TEXT NOT NULL,
  chat_id_ciphertext TEXT NOT NULL,
  bot_username TEXT NOT NULL DEFAULT '',
  linked_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  revoked_at TEXT NOT NULL DEFAULT ''
);

CREATE INDEX IF NOT EXISTS idx_navixa_user_telegram_manual_active
ON navixa_user_telegram_manual(revoked_at, updated_at);
