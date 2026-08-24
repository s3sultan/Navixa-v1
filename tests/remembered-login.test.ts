import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const source = (path: string) => readFileSync(resolve(process.cwd(), path), "utf8");
const account = source("app/account/AccountAccess.tsx");
const session = source("app/api/account/session/route.ts");
const auth = source("worker/userAuth.ts");

assert.match(account, /const REMEMBERED_EMAIL_KEY = "navixa-last-login-email"/);
assert.match(account, /const rememberVerifiedEmail = \(\)/);
assert.match(account, /rememberVerifiedEmail\(\); setNotice\("تم الدخول بأمان/);
assert.match(account, /window\.localStorage\.removeItem\(REMEMBERED_EMAIL_KEY\)/);
assert.match(account, /لا تحتاج إلى كلمة مرور/);
assert.match(account, /ليس بريدي أو استخدم بريدًا آخر/);
assert.match(session, /refreshUserSessionIfNeeded/);
assert.match(session, /headers\["Set-Cookie"\] = refreshed\.cookie/);
assert.match(auth, /USER_SESSION_TTL_SECONDS = 30 \* 24 \* 60 \* 60/);
assert.match(auth, /USER_SESSION_REFRESH_WINDOW_SECONDS = 7 \* 24 \* 60 \* 60/);
assert.match(auth, /HttpOnly; Secure; SameSite=Lax/);

console.log("✅ Remembered-login privacy and persistence contracts verified");
