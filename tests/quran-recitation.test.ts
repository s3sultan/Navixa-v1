import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const source=await readFile(new URL("../app/QuranReader.tsx",import.meta.url),"utf8");
assert.match(source,/بندر بليلة/);
assert.match(source,/ياسر الدوسري/);
assert.match(source,/خالد الجليل/);
assert.match(source,/dailyReciter/);
assert.match(source,/surah\.number/);
assert.match(source,/تشغيل تلاوة السورة/);
assert.doesNotMatch(source,/SpeechSynthesisUtterance/);
console.log("quran recitation matching contract: ok");
