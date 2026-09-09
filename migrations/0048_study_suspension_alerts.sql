-- Guarded official study-suspension monitoring.
-- All delivery remains TEST-only until an explicit later release changes the dispatcher mode.

ALTER TABLE navixa_push_subscriptions ADD COLUMN user_id TEXT NOT NULL DEFAULT '';
CREATE INDEX IF NOT EXISTS idx_navixa_push_subscriptions_user ON navixa_push_subscriptions(user_id, enabled, updated_at);

CREATE TABLE IF NOT EXISTS navixa_study_suspension_test_recipients (
  user_id TEXT PRIMARY KEY,
  enabled INTEGER NOT NULL DEFAULT 1 CHECK(enabled IN (0,1)),
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS navixa_study_suspension_profiles (
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

CREATE TABLE IF NOT EXISTS navixa_study_suspension_delivery (
  recipient_id TEXT NOT NULL,
  channel TEXT NOT NULL CHECK(channel IN ('push','telegram')),
  dedup_key TEXT NOT NULL,
  claim_id TEXT NOT NULL,
  claimed_at TEXT NOT NULL,
  PRIMARY KEY(recipient_id, channel, dedup_key)
);

CREATE TABLE IF NOT EXISTS navixa_study_suspension_sources (
  source_id TEXT PRIMARY KEY,
  entity_type TEXT NOT NULL CHECK(entity_type IN ('moe','education_admin','university')),
  entity_id TEXT NOT NULL,
  name TEXT NOT NULL,
  x_username TEXT NOT NULL DEFAULT '',
  x_account_id TEXT NOT NULL DEFAULT '',
  official_site_url TEXT NOT NULL DEFAULT '',
  education_type TEXT NOT NULL CHECK(education_type IN ('general','higher')),
  scope_type TEXT NOT NULL CHECK(scope_type IN ('national','region','city','education_admin','university','school')),
  scope_ids_json TEXT NOT NULL DEFAULT '[]',
  verified INTEGER NOT NULL DEFAULT 0 CHECK(verified IN (0,1)),
  enabled INTEGER NOT NULL DEFAULT 0 CHECK(enabled IN (0,1)),
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS navixa_study_suspension_cursors (
  source_id TEXT PRIMARY KEY,
  since_post_id TEXT NOT NULL DEFAULT '',
  checked_at TEXT NOT NULL DEFAULT '',
  updated_at TEXT NOT NULL
);

INSERT OR IGNORE INTO navixa_study_suspension_sources(
  source_id, entity_type, entity_id, name, x_username, x_account_id,
  official_site_url, education_type, scope_type, scope_ids_json,
  verified, enabled, updated_at
) VALUES (
  'education-admin:riyadh', 'education_admin', 'riyadh-education', 'إدارة تعليم الرياض',
  'MOE_RYH', '', 'https://sites.moe.gov.sa/Riyadh/', 'general', 'education_admin',
  '["riyadh-education"]', 1, 1, CURRENT_TIMESTAMP
);
