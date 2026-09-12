import assert from "node:assert/strict";
import {readFile} from "node:fs/promises";

const root=new URL("../",import.meta.url);
const [api,model,locationModel,strip,worship,azkar,quran,autoDeploy,styles,syncStyles,prayerPushSync,prayerSettings,prayerWorker]=await Promise.all([
  readFile(new URL("app/api/prayer-times/route.ts",root),"utf8"),
  readFile(new URL("app/prayerTimeModel.ts",root),"utf8"),
  readFile(new URL("app/prayerLocationModel.ts",root),"utf8"),
  readFile(new URL("app/PrayerStrip.tsx",root),"utf8"),
  readFile(new URL("app/WorshipCenter.tsx",root),"utf8"),
  readFile(new URL("app/AzkarList.tsx",root),"utf8"),
  readFile(new URL("app/QuranReader.tsx",root),"utf8"),
  readFile(new URL(".github/workflows/deploy-navixa-auto.yml",root),"utf8"),
  readFile(new URL("app/worship-smart.css",root),"utf8"),
  readFile(new URL("app/prayer-strip-sync.css",root),"utf8"),
  readFile(new URL("app/PrayerPushSync.tsx",root),"utf8"),
  readFile(new URL("app/api/prayer-alerts/settings/route.ts",root),"utf8"),
  readFile(new URL("worker/prayerAlerts.ts",root),"utf8"),
]);

assert.match(api,/METHOD=4/);
assert.match(api,/Umm Al-Qura University, Makkah/);
assert.match(model,/navixa-prayer-adjustments/);
assert.match(model,/diffMinutes/);
assert.match(model,/applyAdjustments/);
assert.match(locationModel,/navixa-prayer-location-v3/);
assert.match(locationModel,/navixa:prayer-location-changed/);
assert.match(locationModel,/mode:"city"/);
assert.match(locationModel,/window\.dispatchEvent/);
assert.match(locationModel,/storage/);
assert.match(strip,/تقويم أم القرى/);
assert.match(strip,/navigator\.geolocation\.getCurrentPosition/);
assert.match(strip,/subscribePrayerLocation/);
assert.match(strip,/writeSharedPrayerLocation/);
assert.match(strip,/تحديد موقعي/);
assert.match(strip,/اعتماد الموقع اليدوي/);
assert.match(strip,/prayer-strip-next-v2/);
assert.match(strip,/fmt12\(to24\(nextTarget\.time\)\)/);
assert.match(worship,/إذن الموقع مرفوض/);
assert.match(worship,/استخدم الرياض مؤقتًا/);
assert.match(worship,/subscribePrayerLocation/);
assert.match(worship,/writeSharedPrayerLocation/);
assert.match(worship,/mode:"city"/);
assert.match(prayerPushSync,/api\/prayer-alerts\/settings/);
assert.match(prayerPushSync,/subscribePrayerLocation/);
assert.match(prayerSettings,/trustedUserMutation/);
assert.match(prayerSettings,/resolveUserSession/);
assert.match(prayerSettings,/navixa_prayer_alert_settings/);
assert.match(prayerWorker,/isUserPushCategoryActive/);
assert.match(prayerWorker,/sendFeaturePush/);
assert.match(prayerWorker,/url:"\/worship"/);
assert.match(prayerWorker,/event\.type==="adhan"/);
assert.match(prayerWorker,/dueWithinWindow/);
assert.match(prayerWorker,/windowMinutes=5/);
assert.match(syncStyles,/prayer-strip-next-v2/);
assert.match(syncStyles,/prayer-edit-location/);
assert.match(azkar,/count.*REPEAT|REPEAT.*count/s);
assert.match(azkar,/عدسة مكبرة/);
assert.match(quran,/quran-verse-card/);
assert.match(quran,/\[1,3,7\]/);
assert.match(quran,/تكبير القراءة/);
assert.match(styles,/quran-verse-tap span/);
assert.match(autoDeploy,/push:\s*\n\s*branches: \[master\]/);
assert.match(autoDeploy,/npm audit --omit=dev --audit-level=high/);
assert.match(autoDeploy,/zizmor/);
assert.match(autoDeploy,/gitleaks\/gitleaks-action@e0c47f4f8be36e29cdc102c57e68cb5cbf0e8d1e\s+# v3\.0\.0/);
assert.doesNotMatch(autoDeploy,/gitleaks\/gitleaks-action@v3/);
assert.match(autoDeploy,/Production smoke test/);

console.log("smart worship, shared prayer location, adhan Push, and automatic verified deployment contract: ok");
