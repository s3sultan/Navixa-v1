import assert from "node:assert/strict";
import test from "node:test";
import { acquireNavixaVoiceAudioStream } from "../app/voice/localNameFallback.ts";

const liveTrack = (onStop?: () => void) => ({
  readyState: "live",
  stop: () => onStop?.(),
});

const streamWith = (audioTracks: unknown[], allTracks = audioTracks) => ({
  getAudioTracks: () => audioTracks,
  getTracks: () => allTracks,
}) as unknown as MediaStream;

test("prefers shared tab or system audio for lecture name listening", async () => {
  let displayCalls = 0;
  let microphoneCalls = 0;
  const audioTrack = liveTrack();
  const videoTrack = liveTrack();
  const sharedStream = streamWith([audioTrack], [audioTrack, videoTrack]);

  const mediaDevices = {
    getDisplayMedia: async (options: DisplayMediaStreamOptions) => {
      displayCalls += 1;
      assert.equal(options.audio, true);
      assert.equal(options.video, true);
      return sharedStream;
    },
    getUserMedia: async () => {
      microphoneCalls += 1;
      throw new Error("microphone should not be requested when shared audio is available");
    },
  } as unknown as MediaDevices;

  const result = await acquireNavixaVoiceAudioStream(mediaDevices);
  assert.equal(result.source, "shared-audio");
  assert.equal(result.stream, sharedStream);
  assert.equal(displayCalls, 1);
  assert.equal(microphoneCalls, 0);
});

test("falls back to the microphone when the selected share has no audio track", async () => {
  let sharedStopCalls = 0;
  let microphoneCalls = 0;
  const sharedVideoTrack = liveTrack(() => { sharedStopCalls += 1; });
  const sharedWithoutAudio = streamWith([], [sharedVideoTrack]);
  const microphoneTrack = liveTrack();
  const microphoneStream = streamWith([microphoneTrack]);

  const mediaDevices = {
    getDisplayMedia: async () => sharedWithoutAudio,
    getUserMedia: async (options: MediaStreamConstraints) => {
      microphoneCalls += 1;
      assert.equal(options.video, false);
      assert.ok(options.audio);
      return microphoneStream;
    },
  } as unknown as MediaDevices;

  const result = await acquireNavixaVoiceAudioStream(mediaDevices);
  assert.equal(result.source, "microphone");
  assert.equal(result.stream, microphoneStream);
  assert.equal(sharedStopCalls, 1);
  assert.equal(microphoneCalls, 1);
});

test("falls back to the microphone when display sharing is cancelled", async () => {
  let microphoneCalls = 0;
  const microphoneTrack = liveTrack();
  const microphoneStream = streamWith([microphoneTrack]);

  const mediaDevices = {
    getDisplayMedia: async () => { throw new Error("cancelled"); },
    getUserMedia: async () => {
      microphoneCalls += 1;
      return microphoneStream;
    },
  } as unknown as MediaDevices;

  const result = await acquireNavixaVoiceAudioStream(mediaDevices);
  assert.equal(result.source, "microphone");
  assert.equal(result.stream, microphoneStream);
  assert.equal(microphoneCalls, 1);
});
