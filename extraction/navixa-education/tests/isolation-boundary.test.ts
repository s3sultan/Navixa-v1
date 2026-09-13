import assert from "node:assert/strict";
import test from "node:test";
import { readFile, readdir } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const here = dirname(fileURLToPath(import.meta.url));
const srcDir = join(here, "..", "src");
const forbidden = [
  "generalPush",
  "telegramBot",
  "../worker/",
  "../../worker/",
  "navixa_push_subscriptions",
  "navixa_user_telegram_links",
  "navixa_study_suspension_",
];

test("Education extraction has no direct NAVIXA runtime or storage dependency", async () => {
  const files = (await readdir(srcDir)).filter(name => name.endsWith(".ts"));
  assert.ok(files.length > 0);

  for (const file of files) {
    const content = await readFile(join(srcDir, file), "utf8");
    for (const token of forbidden) {
      assert.equal(
        content.includes(token),
        false,
        `${file} must not contain forbidden NAVIXA dependency: ${token}`,
      );
    }
  }
});
