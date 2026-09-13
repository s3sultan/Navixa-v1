-- NAVIXA Education standalone schema draft.
-- This file is not wired to any production database and must not be applied to NAVIXA D1.

CREATE TABLE IF NOT EXISTS education_identity_links (
  user_id TEXT PRIMARY KEY,
  external_provider TEXT NOT NULL DEFAULT '',
  external_subject TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  UNIQUE(external_provider, external_subject)
);

CREATE TABLE IF NOT EXISTS education_study_profiles (
  user_id TEXT PRIMARY KEY,
  education_type TEXT NOT NULL CHECK(education_type IN ('general','higher')),
  role TEXT NOT NULL DEFAULT '' CHECK(role IN ('','student','staff')),
  region_id TEXT NOT NULL DEFAULT '',
  city_id TEXT NOT NULL DEFAULT '',
  education_admin_id TEXT NOT NULL DEFAULT '',
  university_id TEXT NOT NULL DEFAULT '',
  school_id TEXT NOT NULL DEFAULT '',
  enabled INTEGER NOT NULL DEFAULT 1 CHECK(enabled IN (0,1)),
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS education_official_sources (
  source_id TEXT PRIMARY KEY,
  entity_type TEXT NOT NULL CHECK(entity_type IN ('moe','education_admin','university')),
  entity_id TEXT NOT NULL,
  name TEXT NOT NULL,
  source_kind TEXT NOT NULL CHECK(source_kind IN ('x','official_site')),
  source_handle TEXT NOT NULL DEFAULT '',
  official_account_id TEXT NOT NULL DEFAULT '',
  official_site_url TEXT NOT NULL DEFAULT '',
  education_type TEXT NOT NULL CHECK(education_type IN ('general','higher')),
  scope_type TEXT NOT NULL CHECK(scope_type IN ('national','region','city','education_admin','university','school')),
  scope_ids_json TEXT NOT NULL DEFAULT '[]',
  verified INTEGER NOT NULL DEFAULT 0 CHECK(verified IN (0,1)),
  enabled INTEGER NOT NULL DEFAULT 0 CHECK(enabled IN (0,1)),
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS education_source_cursors (
  source_id TEXT PRIMARY KEY,
  cursor_value TEXT NOT NULL DEFAULT '',
  checked_at TEXT NOT NULL DEFAULT '',
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS education_notification_subscriptions (
  subscription_id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  channel TEXT NOT NULL CHECK(channel IN ('push','telegram')),
  endpoint TEXT NOT NULL DEFAULT '',
  key_material_ciphertext TEXT NOT NULL DEFAULT '',
  enabled INTEGER NOT NULL DEFAULT 1 CHECK(enabled IN (0,1)),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_education_notification_user
  ON education_notification_subscriptions(user_id, enabled, updated_at);

CREATE TABLE IF NOT EXISTS education_delivery_ledger (
  recipient_id TEXT NOT NULL,
  channel TEXT NOT NULL CHECK(channel IN ('push','telegram')),
  dedup_key TEXT NOT NULL,
  claim_id TEXT NOT NULL,
  claimed_at TEXT NOT NULL,
  delivered_at TEXT NOT NULL DEFAULT '',
  PRIMARY KEY(recipient_id, channel, dedup_key)
);

CREATE TABLE IF NOT EXISTS education_test_recipients (
  user_id TEXT PRIMARY KEY,
  enabled INTEGER NOT NULL DEFAULT 1 CHECK(enabled IN (0,1)),
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS education_audit_log (
  audit_id TEXT PRIMARY KEY,
  actor_id TEXT NOT NULL DEFAULT '',
  action TEXT NOT NULL,
  entity_type TEXT NOT NULL DEFAULT '',
  entity_id TEXT NOT NULL DEFAULT '',
  metadata_json TEXT NOT NULL DEFAULT '{}',
  created_at TEXT NOT NULL
);
