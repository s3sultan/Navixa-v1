CREATE TABLE IF NOT EXISTS navixa_admin_activity (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  admin_email TEXT NOT NULL,
  action TEXT NOT NULL,
  resource TEXT NOT NULL,
  outcome TEXT NOT NULL DEFAULT 'success' CHECK (outcome IN ('success','failure')),
  metadata_json TEXT,
  created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_navixa_admin_activity_created_at
  ON navixa_admin_activity(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_navixa_admin_activity_admin_email
  ON navixa_admin_activity(admin_email, created_at DESC);
