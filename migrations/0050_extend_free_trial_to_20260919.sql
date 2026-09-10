-- Extend the current NAVIXA free-access campaign through the end of
-- 19 September 2026 in Asia/Riyadh (UTC+3), without modifying paid access.
UPDATE navixa_subscribers
SET trial_ends_at = '2026-09-19T20:59:59.999Z'
WHERE status = 'trial'
  AND (
    trial_ends_at = ''
    OR datetime(trial_ends_at) < datetime('2026-09-19T20:59:59.999Z')
  );
