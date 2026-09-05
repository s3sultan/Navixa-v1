import assert from "node:assert/strict";
import {readFile} from "node:fs/promises";

const root=new URL("../",import.meta.url);
const [api,model,strip,worship,azkar,quran,autoDeploy,styles]=await Promise.all([
  readFile(new URL("app/api/prayer-times/route.ts",root),"utf8"),
  readFile(new URL("app/prayerTimeModel.ts",root),"utf8"),
  readFile(new URL("app/PrayerStrip.tsx",root),"utf8"),
  readFile(new URL("app/WorshipCenter.tsx",root),"utf8"),
  readFile(new URL("app/AzkarList.tsx",root),"utf8"),
  readFile(new URL("app/QuranReader.tsx",root),"utf8"),
  readFile(new URL(".github/workflows/deploy-navixa-auto.yml",root),"utf8"),
  readFile(new URL("app/worship-smart.css",root),"utf8"),
]);

assert.match(api,/METHOD=4/);
assert.match(api,/Umm Al-Qura University, Makkah/);
assert.match(model,/navixa-prayer-adjustments/);
assert.match(model,/diffMinutes/);
assert.match(model,/applyAdjustments/);
assert.match(strip,/تقويم أم القرى/);
assert.match(strip,/تعديل.*فرق دقائق|فرق دقائق/);
assert.match(strip,/navigator\.geolocation\.getCurrentPosition/);
assert.match(strip,/navixa-prayer-location-v2/);
assert.match(worship,/إذن الموقع مرفوض/);
assert.match(worship,/استخدم الرياض مؤقتًا/);
assert.match(azkar,/count.*REPEAT|REPEAT.*count/s);
assert.match(azkar,/عدسة مكبرة/);
assert.match(quran,/quran-verse-card/);
assert.match(quran,/\[1,3,7\]/);
assert.match(quran,/تكبير القراءة/);
assert.match(styles,/quran-verse-tap span/);
assert.match(autoDeploy,/push:\s*\n\s*branches: \[master\]/);
assert.match(autoDeploy,/npm audit --omit=dev --audit-level=high/);
assert.match(autoDeploy,/zizmor/);
assert.match(autoDeploy,/gitleaks\/gitleaks-action@ff98106e4c7b2bc287b24eaf42907196329070c7/);
assert.match(autoDeploy,/Production smoke test/);

console.log("smart worship and automatic verified deployment contract: ok");
