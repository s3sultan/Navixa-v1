CREATE TABLE IF NOT EXISTS navixa_referral_settings (
  setting_key TEXT PRIMARY KEY,
  setting_value TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

INSERT OR IGNORE INTO navixa_referral_settings (setting_key, setting_value, updated_at) VALUES
  ('enabled', 'false', datetime('now')),
  ('monthly_reward_days', '7', datetime('now')),
  ('quarterly_reward_days', '14', datetime('now')),
  ('max_rewards_per_month', '4', datetime('now')),
  ('attribution_days', '30', datetime('now'));

CREATE TABLE IF NOT EXISTS navixa_referral_profiles (
  id TEXT PRIMARY KEY,
  contact TEXT NOT NULL UNIQUE,
  display_name TEXT NOT NULL DEFAULT '',
  referral_code TEXT NOT NULL UNIQUE,
  status TEXT NOT NULL DEFAULT 'active',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS navixa_referral_attributions (
  id TEXT PRIMARY KEY,
  referrer_profile_id TEXT NOT NULL,
  referral_code TEXT NOT NULL,
  referred_contact TEXT NOT NULL,
  checkout_intent_id TEXT NOT NULL UNIQUE,
  status TEXT NOT NULL DEFAULT 'pending',
  created_at TEXT NOT NULL,
  expires_at TEXT NOT NULL,
  rewarded_at TEXT NOT NULL DEFAULT '',
  FOREIGN KEY(referrer_profile_id) REFERENCES navixa_referral_profiles(id)
);

CREATE INDEX IF NOT EXISTS idx_navixa_referral_attributions_referrer
  ON navixa_referral_attributions(referrer_profile_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_navixa_referral_attributions_referred
  ON navixa_referral_attributions(referred_contact, status);

CREATE TABLE IF NOT EXISTS navixa_referral_rewards (
  id TEXT PRIMARY KEY,
  referrer_profile_id TEXT NOT NULL,
  attribution_id TEXT NOT NULL UNIQUE,
  provider_payment_id TEXT NOT NULL UNIQUE,
  plan TEXT NOT NULL,
  reward_days INTEGER NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending_credit',
  applied_to_subscription_at TEXT NOT NULL DEFAULT '',
  reversed_at TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY(referrer_profile_id) REFERENCES navixa_referral_profiles(id),
  FOREIGN KEY(attribution_id) REFERENCES navixa_referral_attributions(id)
);

CREATE INDEX IF NOT EXISTS idx_navixa_referral_rewards_profile
  ON navixa_referral_rewards(referrer_profile_id, created_at DESC);

ALTER TABLE navixa_billing_intents ADD COLUMN referral_code TEXT NOT NULL DEFAULT '';
