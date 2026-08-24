import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const root = process.cwd();
const source = (path: string) => readFileSync(resolve(root, path), "utf8");

const stats = source("app/api/stats/route.ts");
assert.match(stats, /s-maxage=30/);
assert.match(stats, /X-NAVIXA-Stats-Cache/);
assert.doesNotMatch(stats.slice(stats.indexOf("export async function GET"), stats.indexOf("export async function POST")), /await ensureSchema\(db\)/);
assert.match(stats, /const NO_STORE = "no-store"/);
assert.match(stats.slice(stats.indexOf("export async function POST")), /NO_STORE/);

const session = source("app/api/account/session/route.ts");
assert.match(session, /Promise\.all\(\[getUserAuthSettings\(db\), resolveUserSession\(request, db\)\]\)/);
assert.match(session, /Cache-Control": "private, no-store"/);
assert.match(session, /"Vary": "Cookie"/);

const matches = source("app/api/matches/route.ts");
assert.match(matches, /PROVIDER_CACHE_TTL_SECONDS=10\*60/);
assert.match(matches, /caches\.default/);
assert.match(matches, /X-NAVIXA-Matches-Provider-Cache/);
assert.match(matches, /cache:"no-store"/);
const home = source("app/page.tsx");
assert.match(home, /api\/matches\?date=.*cache:"default"/);

const domainExpiry = source("worker/domainExpiryAlert.ts");
assert.match(domainExpiry, /RDAP_CACHE_TTL_MS = 6 \* 60 \* 60 \* 1000/);
assert.match(domainExpiry, /cachedDomainExpiry/);
assert.match(domainExpiry, /cacheTtl: 21_600/);

console.log("✅ Safe cache and privacy contracts verified");
