-- قاعدة بيانات ثابتة لربط سلة مع NAVIXA. لا يؤدي تطبيق هذا الملف إلى فتح الدفع
-- أو تسجيل Webhook أو منح استحقاق؛ التسوية الحية تتطلب بوابة تشغيل مستقلة.

CREATE TABLE IF NOT EXISTS navixa_salla_checkout_intents (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  plan_code TEXT NOT NULL,
  expected_product_id TEXT NOT NULL,
  expected_amount_minor INTEGER NOT NULL,
  currency TEXT NOT NULL DEFAULT 'SAR',
  status TEXT NOT NULL DEFAULT 'pending',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  expires_at TEXT NOT NULL,
  CHECK (expected_amount_minor >= 0),
  CHECK (currency = 'SAR'),
  CHECK (status IN ('pending', 'awaiting_webhook', 'settled', 'cancelled', 'expired', 'failed'))
);
CREATE INDEX IF NOT EXISTS navixa_salla_checkout_intents_user_idx ON navixa_salla_checkout_intents(user_id, updated_at DESC);

CREATE TABLE IF NOT EXISTS navixa_salla_orders (
  order_id TEXT PRIMARY KEY,
  checkout_intent_id TEXT NOT NULL UNIQUE,
  user_id TEXT NOT NULL,
  product_id TEXT NOT NULL,
  amount_minor INTEGER NOT NULL,
  currency TEXT NOT NULL DEFAULT 'SAR',
  payment_state TEXT NOT NULL DEFAULT 'received',
  provider_customer_ref TEXT NOT NULL DEFAULT '',
  provider_payload_hash TEXT NOT NULL DEFAULT '',
  paid_at TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  CHECK (amount_minor >= 0),
  CHECK (currency = 'SAR'),
  CHECK (payment_state IN ('received', 'reported_paid', 'verified_paid', 'failed', 'cancelled', 'refunded'))
);
CREATE INDEX IF NOT EXISTS navixa_salla_orders_user_idx ON navixa_salla_orders(user_id, updated_at DESC);

CREATE TABLE IF NOT EXISTS navixa_salla_events (
  provider_event_key TEXT PRIMARY KEY,
  event_type TEXT NOT NULL,
  order_id TEXT NOT NULL,
  payload_hash TEXT NOT NULL,
  processing_state TEXT NOT NULL DEFAULT 'received',
  received_at TEXT NOT NULL,
  processed_at TEXT NOT NULL DEFAULT '',
  CHECK (processing_state IN ('received', 'processing', 'settled', 'rejected', 'retry'))
);
CREATE INDEX IF NOT EXISTS navixa_salla_events_order_idx ON navixa_salla_events(order_id, received_at DESC);

CREATE TABLE IF NOT EXISTS navixa_salla_entitlements (
  id TEXT PRIMARY KEY,
  checkout_intent_id TEXT NOT NULL UNIQUE,
  salla_order_id TEXT NOT NULL UNIQUE,
  user_id TEXT NOT NULL,
  plan_code TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'active',
  starts_at TEXT NOT NULL,
  ends_at TEXT NOT NULL,
  settled_at TEXT NOT NULL,
  revoked_at TEXT NOT NULL DEFAULT '',
  CHECK (status IN ('active', 'revoked', 'expired'))
);
CREATE INDEX IF NOT EXISTS navixa_salla_entitlements_user_idx ON navixa_salla_entitlements(user_id, status, ends_at DESC);
