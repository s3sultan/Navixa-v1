-- Bind NAVIXA Plus entitlement and payment intents to a server-side user identity.
-- Local meeting audio, transcripts, summaries, and personal glossary content remain outside these tables.

ALTER TABLE navixa_subscribers ADD COLUMN user_id TEXT NOT NULL DEFAULT '';
CREATE INDEX IF NOT EXISTS idx_navixa_subscribers_user ON navixa_subscribers(user_id, status);

ALTER TABLE navixa_billing_intents ADD COLUMN user_id TEXT NOT NULL DEFAULT '';
CREATE INDEX IF NOT EXISTS idx_navixa_billing_intents_user ON navixa_billing_intents(user_id, status, expires_at);
