import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const source = (path: string) => readFileSync(resolve(process.cwd(), path), "utf8");
const today = source("app/today/page.tsx");
const css = source("app/today/today.css");
const home = source("app/page.tsx");

assert.match(today, /FeatureAccessGate feature="صفحة يومي والإضافة السريعة"/);
assert.match(today, /PersonalReminderEngine/);
assert.match(today, /saveAcademicReminder/);
assert.match(today, /const TASKS_KEY = "navixa-life-tasks"/);
assert.match(today, /today-bottom-nav/);
assert.match(today, /quick-add-sheet/);
assert.match(today, /href="\/#alerts"/);
assert.match(css, /@media\(max-width:760px\)/);
assert.match(css, /\.today-bottom-nav\{position:fixed/);
assert.match(home, /href="\/today"/);
assert.match(home, /window\.location\.hash==="#alerts"/);

console.log("✅ Today quick-add and reminder navigation contracts verified");
