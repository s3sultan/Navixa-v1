import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const here = dirname(fileURLToPath(import.meta.url));
const schemaPath = join(here, "..", "schema", "0001_education_core.sql");

const requiredTables = [
  "education_identity_links",
  "education_study_profiles",
  "education_official_sources",
  "education_source_cursors",
  "education_notification_subscriptions",
  "education_delivery_ledger",
  "education_test_recipients",
  "education_audit_log",
];

test("standalone schema is Education-owned and contains no NAVIXA production table references", async () => {
  const sql = await readFile(schemaPath, "utf8");
  assert.equal(sql.includes("navixa_"), false);
  for (const table of requiredTables) assert.equal(sql.includes(table), true, `missing ${table}`);
});

test("standalone schema does not seed or enable live recipients", async () => {
  const sql = await readFile(schemaPath, "utf8");
  assert.equal(/INSERT\s+INTO\s+education_test_recipients/i.test(sql), false);
  assert.equal(/INSERT\s+INTO\s+education_notification_subscriptions/i.test(sql), false);
});
