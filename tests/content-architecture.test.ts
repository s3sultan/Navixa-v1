import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { ar } from "../app/content/ar.ts";
import { en } from "../app/content/en.ts";
import { arCta } from "../app/content/cta/ar.ts";
import { enCta } from "../app/content/cta/en.ts";
import { languageIdentity } from "../app/content/languages.ts";
import { arMessages } from "../app/content/messages/ar.ts";
import { copyCatalog } from "../app/content/catalog.ts";

const root = process.cwd();

test("static copy dictionaries contain no dynamic formatter functions", () => {
  const arabic = readFileSync(`${root}/app/content/ar.ts`, "utf8");
  const english = readFileSync(`${root}/app/content/en.ts`, "utf8");
  assert.equal(arabic.includes("=>"), false);
  assert.equal(english.includes("=>"), false);
});

test("language identity keeps Arabic RTL and English LTR with matching arrows", () => {
  assert.deepEqual(languageIdentity.ar, { code: "ar", direction: "rtl", locale: "ar-SA", arrow: "←" });
  assert.deepEqual(languageIdentity.en, { code: "en", direction: "ltr", locale: "en-US", arrow: "→" });
});

test("static copy, CTA labels, dynamic messages, and catalog IDs remain separated", () => {
  assert.equal(ar.smartListening.label, "سماع نداء الاسم");
  assert.equal(en.smartListening.label, "Name listener");
  assert.equal(arCta.watchTutorial, "شاهد الشرح في 25 ثانية");
  assert.equal(enCta.watchTutorial, "Watch the 25-second guide");
  assert.equal(arMessages.smartListening.detectedName("سلمان"), "تم رصد سلمان");
  assert.equal(copyCatalog["plus.heroTitle"].category, "subscription");
  assert.equal(copyCatalog["smartListening.detectedName"].category, "dynamic");
});
