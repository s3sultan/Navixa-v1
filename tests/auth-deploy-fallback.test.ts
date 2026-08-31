import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("production deploy preserves bindings and does not block Google login when Resend is absent", async () => {
  const workflow = await readFile(new URL("../.github/workflows/deploy-navixa.yml", import.meta.url), "utf8");
  assert.match(workflow, /config\.keep_vars = true/);
  assert.match(workflow, /RESEND_API_KEY is currently unavailable/);
  assert.doesNotMatch(workflow, /Historical auth bindings activated/);
  assert.doesNotMatch(workflow, /Recover missing OTP secrets from last healthy Worker version/);
});
