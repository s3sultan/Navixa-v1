import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";
const root=new URL("../",import.meta.url);
test("progress and reminders are protected and reminder records stay user-scoped",async()=>{const [progress,reminders,route]=await Promise.all([readFile(new URL("app/progress/page.tsx",root),"utf8"),readFile(new URL("app/reminders/page.tsx",root),"utf8"),readFile(new URL("app/api/reminders/route.ts",root),"utf8")]);assert.match(progress,/FeatureAccessGate/);assert.match(reminders,/FeatureAccessGate/);assert.match(route,/resolveUserSession/);assert.match(route,/WHERE user_id=\?/);assert.match(route,/DELETE FROM navixa_important_reminders WHERE id=\? AND user_id=\?/);assert.match(route,/private, no-store/)});
