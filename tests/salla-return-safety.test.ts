import assert from "node:assert/strict";
import test from "node:test";
import { buildSallaReturnUrl, parseSallaReturnIntent } from "../app/billing/providers/salla.ts";

test("رابط عودة سلة يحدد المزود والنية دون تمرير حالة دفع أو بريد", () => {
  const url = new URL(buildSallaReturnUrl("https://navixasa.com", "intent_founder_2026_001"));
  assert.equal(url.pathname, "/plus/complete");
  assert.equal(url.searchParams.get("provider"), "salla");
  assert.equal(url.searchParams.get("intent"), "intent_founder_2026_001");
  assert.equal(url.searchParams.has("status"), false);
  assert.equal(url.searchParams.has("email"), false);
});

test("نية عودة سلة لا تقبل قيمًا غير آمنة", () => {
  assert.equal(parseSallaReturnIntent("intent_founder_2026_001"), "intent_founder_2026_001");
  assert.equal(parseSallaReturnIntent("<script>alert(1)</script>"), null);
  assert.equal(parseSallaReturnIntent(null), null);
});
