import assert from "node:assert/strict";
import test from "node:test";
import { academicSuggestions } from "../app/meetings/academicSuggestions.ts";

test("academic suggestions extract multiple dates from one Arabic and English summary", () => {
  const value = academicSuggestions("سيكون لدينا كويز من الوحدة 2 إلى 4 بتاريخ 18/6/2026، ثم ميد يوم 25-06-2026. The presentation is on 03/07/2026.", 2026);
  assert.equal(value.length, 3);
  assert.deepEqual(value.map((item) => item.date), ["2026-06-18", "2026-06-25", "2026-07-03"]);
});

test("academic suggestions normalize Arabic numerals and omit invalid dates", () => {
  const value = academicSuggestions("الكويز بتاريخ ١٨/٦/٢٠٢٦، والاختبار بتاريخ 45/15/2026.", 2026);
  assert.equal(value.length, 1);
  assert.equal(value[0]?.date, "2026-06-18");
});
