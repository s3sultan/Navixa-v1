CREATE TABLE IF NOT EXISTS navixa_device_control_requests (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  source_device_class TEXT NOT NULL CHECK (source_device_class IN ('mobile','computer')),
  target_device_class TEXT NOT NULL CHECK (target_device_class IN ('mobile','computer')),
  command TEXT NOT NULL CHECK (command IN ('prepare_name_listener','prepare_screen_watch','open_alerts','open_account_sync')),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','acknowledged','dismissed')),
  created_at TEXT NOT NULL,
  expires_at TEXT NOT NULL,
  acknowledged_at TEXT NOT NULL DEFAULT ''
);

CREATE INDEX IF NOT EXISTS idx_navixa_device_control_target
  ON navixa_device_control_requests(user_id, target_device_class, status, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_navixa_device_control_source
  ON navixa_device_control_requests(user_id, source_device_class, created_at DESC);
