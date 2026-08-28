import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { isValidUserEmail, normalizeUserEmail } from "../worker/userAuth.ts";

test("OTP accepts valid email providers without a Gmail-only restriction", async () => {
  for (const address of [
    "person@gmail.com",
    "person@icloud.com",
    "person@outlook.com",
    "person@yahoo.com",
    "person@company.sa",
  ]) assert.equal(isValidUserEmail(normalizeUserEmail(address)), true, address);

  const [requestRoute, accountPage, deployWorkflow] = await Promise.all([
    readFile(new URL("../app/api/account/code/request/route.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/account/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../.github/workflows/deploy-navixa.yml", import.meta.url), "utf8"),
  ]);

  assert.doesNotMatch(requestRoute, /endsWith\([^)]*gmail|@gmail\.com.*(?:required|only)/i);
  assert.match(requestRoute, /providerReady/);
  assert.match(requestRoute, /email_otp_enabled/);
  assert.match(accountPage, /iCloud/);
  assert.match(accountPage, /Outlook/);
  assert.match(accountPage, /حساب Google مجرد خيار إضافي وليس شرطًا/);
  assert.match(deployWorkflow, /Upload OTP email secrets when configured/);
  assert.match(deployWorkflow, /RESEND_API_KEY/);
  assert.match(deployWorkflow, /NAVIXA_AUTH_CODE_PEPPER/);
});
