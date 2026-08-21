-- NAVIXA Plus Early Access: separate user identity from local content and admin sessions.
PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS navixa_user_auth_settings (
  setting_key TEXT PRIMARY KEY,
  setting_value TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS navixa_users (
  id TEXT PRIMARY KEY,
  email TEXT NOT NULL UNIQUE,
  email_hash TEXT NOT NULL UNIQUE,
  webauthn_user_id TEXT NOT NULL UNIQUE,
  status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','active','suspended')),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  last_login_at TEXT NOT NULL DEFAULT ''
);

CREATE TABLE IF NOT EXISTS navixa_user_sessions (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  token_hash TEXT NOT NULL UNIQUE,
  created_at TEXT NOT NULL,
  expires_at TEXT NOT NULL,
  last_seen_at TEXT NOT NULL DEFAULT '',
  revoked_at TEXT NOT NULL DEFAULT '',
  FOREIGN KEY(user_id) REFERENCES navixa_users(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_navixa_user_sessions_user_active
  ON navixa_user_sessions(user_id, expires_at, revoked_at);

CREATE TABLE IF NOT EXISTS navixa_user_passkeys (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  credential_id TEXT NOT NULL UNIQUE,
  public_key TEXT NOT NULL,
  counter INTEGER NOT NULL DEFAULT 0,
  transports_json TEXT NOT NULL DEFAULT '[]',
  device_type TEXT NOT NULL DEFAULT '',
  backed_up INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL,
  last_used_at TEXT NOT NULL DEFAULT '',
  revoked_at TEXT NOT NULL DEFAULT '',
  FOREIGN KEY(user_id) REFERENCES navixa_users(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_navixa_user_passkeys_user_active
  ON navixa_user_passkeys(user_id, revoked_at);

CREATE TABLE IF NOT EXISTS navixa_user_webauthn_challenges (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  purpose TEXT NOT NULL CHECK(purpose IN ('register','authenticate')),
  challenge TEXT NOT NULL,
  created_at TEXT NOT NULL,
  expires_at TEXT NOT NULL,
  consumed_at TEXT NOT NULL DEFAULT '',
  FOREIGN KEY(user_id) REFERENCES navixa_users(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_navixa_user_webauthn_challenges_active
  ON navixa_user_webauthn_challenges(user_id, purpose, expires_at, consumed_at);

CREATE TABLE IF NOT EXISTS navixa_user_login_codes (
  id TEXT PRIMARY KEY,
  email_hash TEXT NOT NULL,
  code_hash TEXT NOT NULL,
  purpose TEXT NOT NULL DEFAULT 'login' CHECK(purpose IN ('login','recover')),
  created_at TEXT NOT NULL,
  expires_at TEXT NOT NULL,
  consumed_at TEXT NOT NULL DEFAULT '',
  attempts INTEGER NOT NULL DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_navixa_user_login_codes_active
  ON navixa_user_login_codes(email_hash, purpose, expires_at, consumed_at);

INSERT OR IGNORE INTO navixa_user_auth_settings(setting_key,setting_value,updated_at) VALUES
  ('user_auth_enabled','false',datetime('now')),
  ('email_otp_enabled','false',datetime('now')),
  ('passkeys_enabled','false',datetime('now')),
  ('early_access_enabled','false',datetime('now')),
  ('trial_days','14',datetime('now'));
