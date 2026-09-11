import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import {
  listMeetingSummaryAutomationRuns,
  summarizeMeetingTranscript,
} from "../app/meetings/meetingAutomation.ts";
import { buildLocalSummary } from "../app/meetings/meetingSummary.ts";

const root = new URL("../", import.meta.url);

test("meeting summary automation preserves the existing local summary result", async () => {
  const transcript = "قرر الفريق اعتماد الخطة الجديدة اليوم. يجب مراجعة المهام غدًا. هل نرسل التقرير بعد المراجعة؟";
  const expected = buildLocalSummary(transcript);

  const actual = await summarizeMeetingTranscript(transcript, {
    sessionId: "session-test",
    partId: "part-test",
    source: "test",
  });

  assert.deepEqual(actual, expected);

  const runs = await listMeetingSummaryAutomationRuns();
  const run = runs[0];
  assert.equal(run.status, "succeeded");
  assert.equal(run.skillId, "meeting.summary.local");
  assert.equal(run.trigger.type, "event");
  assert.equal(run.metadata?.sessionId, "session-test");

  const stored = JSON.stringify(run);
  assert.equal(stored.includes(transcript), false);
  assert.equal(stored.includes(expected.summary), false);
});

test("meeting summary automation keeps concurrent local requests isolated", async () => {
  const first = "اتفق الفريق على إطلاق النسخة الأولى. مطلوب تجهيز قائمة التحقق قبل النشر.";
  const second = "قرر الفريق تأجيل الموعد. يجب إرسال التحديث للمشاركين بعد المراجعة.";

  const [firstResult, secondResult] = await Promise.all([
    summarizeMeetingTranscript(first, { partId: "part-a", source: "test" }),
    summarizeMeetingTranscript(second, { partId: "part-b", source: "test" }),
  ]);

  assert.deepEqual(firstResult, buildLocalSummary(first));
  assert.deepEqual(secondResult, buildLocalSummary(second));

  const runs = await listMeetingSummaryAutomationRuns();
  assert.ok(runs.some((run) => run.metadata?.partId === "part-a" && run.status === "succeeded"));
  assert.ok(runs.some((run) => run.metadata?.partId === "part-b" && run.status === "succeeded"));
});

test("automatic transcription completion uses automation core and privacy-safe persistent history", async () => {
  const [studio, adapter] = await Promise.all([
    readFile(new URL("app/meetings/MeetingStudio.tsx", root), "utf8"),
    readFile(new URL("app/meetings/meetingAutomation.ts", root), "utf8"),
  ]);

  assert.match(studio, /import \{ summarizeMeetingTranscript \} from "\.\/meetingAutomation"/);
  assert.match(studio, /worker\.onmessage = async/);
  assert.match(studio, /await summarizeMeetingTranscript\(correctedTranscript/);
  assert.match(studio, /\.catch\(\(\) => buildLocalSummary\(correctedTranscript\)\)/);
  assert.match(adapter, /PERSISTENT_RUN_HISTORY_URL = "\/api\/automation-runs"/);
  assert.match(adapter, /keepalive: true/);
  assert.match(adapter, /credentials: "same-origin"/);
  assert.match(adapter, /Persistent history is observational only; it must never break local automation/);
  assert.match(adapter, /Keep transcript and generated summary out of generic run history/);

  const payloadStart = adapter.indexOf("function persistencePayload");
  const payloadEnd = adapter.indexOf("function persistRunBestEffort");
  const payload = adapter.slice(payloadStart, payloadEnd);
  assert.ok(payloadStart >= 0 && payloadEnd > payloadStart);
  assert.doesNotMatch(payload, /\binput\s*:|\boutput\s*:|\berror\s*:|\btranscript\s*:|\bsummary\s*:/);
});
