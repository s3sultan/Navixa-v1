export const MEETING_RECORDER_TIMESLICE_MS = 10_000;

export function getMeetingChunkDurationMs(chunkMinutes: number) {
  const safeMinutes = Number.isFinite(chunkMinutes) && chunkMinutes > 0 ? chunkMinutes : 30;
  return safeMinutes * 60 * 1000;
}

export function shouldRotateMeetingRecorder(options: {
  partStartedAt: number;
  now: number;
  chunkMinutes: number;
  stopRequested: boolean;
  rotationPending: boolean;
  recorderState: RecordingState;
}) {
  if (options.stopRequested || options.rotationPending || options.recorderState !== "recording") return false;
  return options.now - options.partStartedAt >= getMeetingChunkDurationMs(options.chunkMinutes);
}

export function hasLiveMeetingAudio(stream: MediaStream | null | undefined) {
  return Boolean(stream?.getAudioTracks().some((track) => track.readyState === "live"));
}
