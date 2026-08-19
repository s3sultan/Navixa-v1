CREATE TABLE IF NOT EXISTS navixa_billing_intents (
  id TEXT PRIMARY KEY,
  contact TEXT NOT NULL,
  plan TEXT NOT NULL,
  amount INTEGER NOT NULL,
  currency TEXT NOT NULL DEFAULT 'SAR',
  mode TEXT NOT NULL DEFAULT 'test',
  status TEXT NOT NULL DEFAULT 'pending',
  provider_payment_id TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  expires_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_navixa_billing_intents_status
  ON navixa_billing_intents(status, expires_at DESC);
