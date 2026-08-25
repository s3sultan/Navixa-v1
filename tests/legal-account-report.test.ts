import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
const [terms,refunds,report,settings]=await Promise.all([
  readFile(new URL("../app/terms/page.tsx",import.meta.url),"utf8"),
  readFile(new URL("../app/refunds/page.tsx",import.meta.url),"utf8"),
  readFile(new URL("../app/api/admin/user-auth-settings/route.ts",import.meta.url),"utf8"),
  readFile(new URL("../app/admin/settings/AdminUserAuthSettings.tsx",import.meta.url),"utf8"),
]);
assert.match(terms,/الشروط والأحكام/);assert.match(refunds,/سياسة الإلغاء والاسترداد/);
assert.match(report,/recentAccounts/);assert.match(report,/last_login_at/);assert.match(report,/Cache-Control.*no-store/);
assert.match(settings,/البريد وآخر دخول/);assert.match(settings,/عرض إداري محمي/);
console.log("legal pages and admin account report contract: ok");
