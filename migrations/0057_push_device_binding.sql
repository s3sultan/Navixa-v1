ALTER TABLE navixa_push_subscriptions ADD COLUMN device_class TEXT NOT NULL DEFAULT '' CHECK (device_class IN ('','computer','mobile'));
ALTER TABLE navixa_push_subscriptions ADD COLUMN device_session_id TEXT NOT NULL DEFAULT '';

CREATE INDEX IF NOT EXISTS idx_navixa_push_user_device
  ON navixa_push_subscriptions(user_id, device_class, enabled);

CREATE INDEX IF NOT EXISTS idx_navixa_push_device_session
  ON navixa_push_subscriptions(device_session_id, enabled);
