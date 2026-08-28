-- Persistent authentication rate limits shared across Cloudflare Worker instances.
PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS navixa_auth_rate_limits (
  bucket_hash TEXT PRIMARY KEY,
  attempts INTEGER NOT NULL DEFAULT 0,
  expires_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_navixa_auth_rate_limits_expiry
  ON navixa_auth_rate_limits(expires_at);
