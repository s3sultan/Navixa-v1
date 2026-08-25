-- Administrative-only operational summaries. No user identifier, URL path,
-- page content, request body, IP address, cookie, or browser recording is stored.
CREATE TABLE IF NOT EXISTS navixa_weekly_site_health (
  week_start TEXT PRIMARY KEY,
  status TEXT NOT NULL,
  checks_json TEXT NOT NULL,
  alerted_at TEXT NOT NULL DEFAULT '',
  email_sent INTEGER NOT NULL DEFAULT 0,
  telegram_sent INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS navixa_csp_report_summaries (
  bucket_day TEXT NOT NULL,
  directive TEXT NOT NULL,
  blocked_host TEXT NOT NULL,
  report_count INTEGER NOT NULL,
  first_seen_at TEXT NOT NULL,
  last_seen_at TEXT NOT NULL,
  PRIMARY KEY (bucket_day,directive,blocked_host)
);
