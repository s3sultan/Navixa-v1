-- المراجعة اليدوية لباقات سلة Plus. لا تخزن بيانات بطاقات أو حمولة دفع،
-- ولا تمنح صلاحية تلقائيًا. تظل الموافقة الإدارية بعد التحقق داخل سلة شرطًا إلزاميًا.

CREATE TABLE IF NOT EXISTS navixa_salla_manual_reviews (
  id TEXT PRIMARY KEY,
  checkout_intent_id TEXT NOT NULL UNIQUE,
  user_id TEXT NOT NULL,
  review_lock TEXT NOT NULL UNIQUE,
  status TEXT NOT NULL DEFAULT 'pending',
  reviewed_by TEXT NOT NULL DEFAULT '',
  salla_order_id TEXT NOT NULL DEFAULT '',
  verification_method TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL,
  reviewed_at TEXT NOT NULL DEFAULT '',
  CHECK (status IN ('pending', 'processing', 'approved', 'rejected'))
);
CREATE INDEX IF NOT EXISTS navixa_salla_manual_reviews_queue_idx ON navixa_salla_manual_reviews(status, created_at ASC);
