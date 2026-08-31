import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("OTP field exposes standard one-time-code autofill hints", async () => {
  const account = await readFile(new URL("../app/account/AccountAccess.tsx", import.meta.url), "utf8");
  assert.match(account, /autoComplete="one-time-code"/);
  assert.match(account, /inputMode="numeric"/);
  assert.match(account, /name="one-time-code"/);
  assert.match(account, /pattern="\[0-9\]\*"/);
});

test("OTP email makes the six digit login code explicit for mail clients", async () => {
  const route = await readFile(new URL("../app/api/account/code/request/route.ts", import.meta.url), "utf8");
  assert.match(route, /subject: `رمز تسجيل الدخول إلى NAVIXA: \$\{loginCode\}`/);
  assert.match(route, /رمز التحقق لتسجيل الدخول إلى NAVIXA هو: \$\{loginCode\}/);
});

test("Google Identity readiness retries instead of relying on one script load event", async () => {
  const account = await readFile(new URL("../app/account/AccountAccess.tsx", import.meta.url), "utf8");
  assert.match(account, /retryGoogleMount/);
  assert.match(account, /setTimeout\(retryGoogleMount, 180\)/);
});
