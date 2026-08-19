-- Allows one device subscription to receive more than one chosen alert for a fixture.
-- Existing before_minutes remains as a backward-compatible fallback.
ALTER TABLE navixa_push_subscriptions
  ADD COLUMN before_minutes_json TEXT NOT NULL DEFAULT '[]';
