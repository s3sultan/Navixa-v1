import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("شاشة الدخول تعرض زر Google واحدًا وتمنع تجاوز عرض الجوال", async () => {
  const [account, styles] = await Promise.all([
    readFile(new URL("../app/account/AccountAccess.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/account/account.css", import.meta.url), "utf8"),
  ]);
  assert.match(account, /renderButton\(target/);
  assert.doesNotMatch(account, /openGoogleLoginOnMobile/);
  assert.equal((account.match(/renderButton\(/g) || []).length, 1);
  assert.doesNotMatch(account, /className="account-secondary"[^>]*>[^<]*الدخول بحساب Google/);
  assert.match(styles, /\.account-page\{min-height:100vh;max-width:100vw;overflow-x:clip/);
  assert.match(styles, /max-width:calc\(100vw - 30px\)/);
});
