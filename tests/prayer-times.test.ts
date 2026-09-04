import assert from "node:assert/strict";
import {readFile} from "node:fs/promises";
import test from "node:test";

const strip=await readFile(new URL("../app/PrayerStrip.tsx",import.meta.url),"utf8");
const route=await readFile(new URL("../app/api/prayer-times/route.ts",import.meta.url),"utf8");

test("prayer API is date, location, and Saudi calculation-method aware",()=>{
  assert.match(route,/supportedMethods=new Set\(\[3,4,8,9,10\]\)/);
  assert.match(route,/searchParams\.get\("date"\)/);
  assert.match(route,/requestedMethod=Number\(searchParams\.get\("method"\)\|\|4\)/);
  assert.match(route,/latitude=/);
  assert.match(route,/longitude=/);
  assert.match(route,/lat<-90\|\|lat>90\|\|lng<-180\|\|lng>180/);
});

test("manual prayer edits are stored as rolling calendar calibration instead of fixed clocks",()=>{
  assert.match(strip,/navixa-prayer-calibration-v2/);
  assert.match(strip,/adhanOffsets/);
  assert.match(strip,/iqamaDelays/);
  assert.match(strip,/clockDifference\(requestedAdhan,baseTimings\[name\]\)/);
  assert.match(strip,/applyCalibration\(baseTimings,next\)/);
  assert.match(strip,/currentDay/);
  assert.match(strip,/date=\$\{apiDate\(now\)\}/);
});

test("legacy fixed manual prayer times migrate and device location can be enabled explicitly",()=>{
  assert.match(strip,/LEGACY_PRAYER_KEY="navixa-prayer-manual"/);
  assert.match(strip,/deriveCalibration\(base,legacyManual/);
  assert.match(strip,/localStorage\.removeItem\(LEGACY_PRAYER_KEY\)/);
  assert.match(strip,/navigator\.geolocation\.getCurrentPosition/);
  assert.match(strip,/استخدام موقعي الحالي/);
  assert.match(strip,/أم القرى - مكة/);
});
