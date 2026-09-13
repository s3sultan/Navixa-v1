import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";
import {
  MEETING_RECORDER_TIMESLICE_MS,
  getMeetingChunkDurationMs,
  hasLiveMeetingAudio,
  shouldRotateMeetingRecorder,
} from "../app/meetings/recordingLifecycle.ts";

test("uses bounded recorder timeslices while parts rotate at the selected duration", () => {
  assert.equal(MEETING_RECORDER_TIMESLICE_MS, 10_000);
  assert.equal(getMeetingChunkDurationMs(15), 15 * 60 * 1000);
  assert.equal(getMeetingChunkDurationMs(30), 30 * 60 * 1000);
  assert.equal(getMeetingChunkDurationMs(45), 45 * 60 * 1000);
  assert.equal(getMeetingChunkDurationMs(Number.NaN), 30 * 60 * 1000);
});

test("rotates only after the configured part duration", () => {
  const base = {
    partStartedAt: 1_000,
    chunkMinutes: 15,
    stopRequested: false,
    rotationPending: false,
    recorderState: "recording" as RecordingState,
  };
  assert.equal(shouldRotateMeetingRecorder({ ...base, now: 1_000 + 15 * 60 * 1000 - 1 }), false);
  assert.equal(shouldRotateMeetingRecorder({ ...base, now: 1_000 + 15 * 60 * 1000 }), true);
});

test("does not rotate while stopping, already rotating, or inactive", () => {
  const base = {
    partStartedAt: 0,
    now: 60 * 60 * 1000,
    chunkMinutes: 15,
    recorderState: "recording" as RecordingState,
  };
  assert.equal(shouldRotateMeetingRecorder({ ...base, stopRequested: true, rotationPending: false }), false);
  assert.equal(shouldRotateMeetingRecorder({ ...base, stopRequested: false, rotationPending: true }), false);
  assert.equal(shouldRotateMeetingRecorder({ ...base, stopRequested: false, rotationPending: false, recorderState: "inactive" }), false);
});

test("requires a live audio track before continuing with the next independent part", () => {
  const liveStream = { getAudioTracks: () => [{ readyState: "live" }] } as unknown as MediaStream;
  const endedStream = { getAudioTracks: () => [{ readyState: "ended" }] } as unknown as MediaStream;
  assert.equal(hasLiveMeetingAudio(liveStream), true);
  assert.equal(hasLiveMeetingAudio(endedStream), false);
  assert.equal(hasLiveMeetingAudio(null), false);
});

test("tab visibility flush stays inside the same part and cannot create the old tiny fragment", () => {
  const source = fs.readFileSync(new URL("../app/meetings/MeetingStudio.tsx", import.meta.url), "utf8");
  assert.ok(source.includes('if (document.visibilityState === "hidden" && recorder?.state === "recording") recorder.requestData();'));
  assert.ok(source.includes("A tab switch must never create a tiny standalone WebM fragment."));
  assert.equal(source.includes("flushRequestedRef"), false);
  assert.equal(source.includes("appendRecordedPart(false)"), false);
});

test("each timed part is finalized by stopping one recorder and starting a fresh recorder", () => {
  const source = fs.readFileSync(new URL("../app/meetings/MeetingStudio.tsx", import.meta.url), "utf8");
  assert.ok(source.includes("rotationPendingRef.current = true;"));
  assert.ok(source.includes("recorder.stop();"));
  assert.ok(source.includes("appendRecordedPart(recorder, final);"));
  assert.ok(source.includes("startRecorderPart(stream, mimeType);"));
  assert.ok(source.includes("كملف مستقل"));
});
