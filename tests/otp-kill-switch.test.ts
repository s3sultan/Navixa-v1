import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";

const requestRoute = await readFile(new URL("../app/api/account/code/request/route.ts", import.meta.url), "utf8");
const verifyRoute = await readFile(new URL("../app/api/account/code/verify/route.ts", import.meta.url), "utf8");

test("email OTP kill switch blocks new code requests instead of re-enabling itself", () => {
  assert.match(requestRoute, /!settings\.emailOtpEnabled/);
  assert.doesNotMatch(requestRoute, /setting_value='true'/);
  assert.doesNotMatch(requestRoute, /email_otp_enabled','true'/);
});

test("email OTP kill switch blocks verification of outstanding codes", () => {
  assert.match(verifyRoute, /!settings\.emailOtpEnabled/);
  assert.doesNotMatch(verifyRoute, /setting_value='true'/);
  assert.doesNotMatch(verifyRoute, /email_otp_enabled','true'/);
});
