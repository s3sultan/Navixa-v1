-- NAVIXA Plus trial and subscription records. No payment card data is stored here.
CREATE TABLE IF NOT EXISTS navixa_subscribers (
  id TEXT PRIMARY KEY,
  contact TEXT NOT NULL UNIQUE,
  display_name TEXT NOT NULL DEFAULT '',
  plan TEXT NOT NULL DEFAULT 'trial',
  status TEXT NOT NULL DEFAULT 'waitlist',
  trial_started_at TEXT NOT NULL DEFAULT '',
  trial_ends_at TEXT NOT NULL DEFAULT '',
  subscription_ends_at TEXT NOT NULL DEFAULT '',
  source TEXT NOT NULL DEFAULT 'plus_page',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_navixa_subscribers_status ON navixa_subscribers(status, updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_navixa_subscribers_plan ON navixa_subscribers(plan, status);

CREATE TABLE IF NOT EXISTS navixa_billing_events (
  id TEXT PRIMARY KEY,
  provider_event_id TEXT NOT NULL UNIQUE,
  subscriber_id TEXT NOT NULL DEFAULT '',
  event_type TEXT NOT NULL,
  mode TEXT NOT NULL DEFAULT 'test',
  payload_json TEXT NOT NULL DEFAULT '{}',
  created_at TEXT NOT NULL,
  processed_at TEXT NOT NULL DEFAULT ''
);

CREATE INDEX IF NOT EXISTS idx_navixa_billing_events_subscriber ON navixa_billing_events(subscriber_id, created_at DESC);
