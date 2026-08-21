-- Shared meeting glossary proposals contain only bounded, sanitised terms and aliases.
-- No audio, transcript, meeting title, user identifier, or source file is stored.
CREATE TABLE IF NOT EXISTS navixa_meeting_glossary_proposals (
  id TEXT PRIMARY KEY,
  canonical_text TEXT NOT NULL,
  normalized_text TEXT NOT NULL,
  aliases_json TEXT NOT NULL DEFAULT '[]',
  language TEXT NOT NULL DEFAULT 'mixed',
  source TEXT NOT NULL,
  source_count INTEGER NOT NULL DEFAULT 1,
  status TEXT NOT NULL DEFAULT 'pending',
  created_at TEXT NOT NULL,
  reviewed_at TEXT NOT NULL DEFAULT '',
  reviewed_by TEXT NOT NULL DEFAULT ''
);
CREATE INDEX IF NOT EXISTS idx_navixa_meeting_glossary_proposals_review
  ON navixa_meeting_glossary_proposals(status, created_at DESC);
