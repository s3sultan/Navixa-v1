export function isNameSenseNoiseFloorCandidate(frameRms, minRms = 0.0035) {
  if (!Number.isFinite(frameRms) || frameRms < 0 || !Number.isFinite(minRms) || minRms <= 0) return false;
  const quietCeiling = Math.min(0.008, Math.max(minRms, minRms * 1.75));
  return frameRms <= quietCeiling;
}

export function deriveNameSenseAdaptiveVadThreshold(noiseFloorRms, minRms = 0.0035) {
  const safeMin = Number.isFinite(minRms) && minRms > 0 ? minRms : 0.0035;
  const safeNoiseFloor = Number.isFinite(noiseFloorRms) && noiseFloorRms >= 0 ? noiseFloorRms : 0;
  const upperBound = Math.max(safeMin, 0.01);
  return Math.min(upperBound, Math.max(safeMin, safeNoiseFloor * 2.25));
}

export function analyzeNameSenseSignal(input, sampleRate, config = {}) {
  const minRms = Number.isFinite(config.minRms) ? config.minRms : 0.0035;
  const minVariance = Number.isFinite(config.minVariance) ? config.minVariance : 1e-6;
  const frameMs = Number.isFinite(config.frameMs) ? config.frameMs : 20;
  const minActiveSpeechMs = Number.isFinite(config.minActiveSpeechMs) ? config.minActiveSpeechMs : 80;
  if (!(input instanceof Float32Array) || !input.length || !Number.isFinite(sampleRate) || sampleRate <= 0) {
    return { passed: false, rms: 0, variance: 0, peak: 0, vadSpeechConfirmed: false };
  }

  let sum = 0;
  let sumSquares = 0;
  let peak = 0;
  for (const raw of input) {
    const sample = Number.isFinite(raw) ? raw : 0;
    sum += sample;
    sumSquares += sample * sample;
    peak = Math.max(peak, Math.abs(sample));
  }
  const mean = sum / input.length;
  const rms = Math.sqrt(sumSquares / input.length);
  let varianceSum = 0;
  for (const raw of input) {
    const sample = Number.isFinite(raw) ? raw : 0;
    const centered = sample - mean;
    varianceSum += centered * centered;
  }
  const variance = varianceSum / input.length;

  const frameSamples = Math.max(1, Math.round(sampleRate * frameMs / 1000));
  const requiredFrames = Math.max(1, Math.ceil(minActiveSpeechMs / frameMs));
  let consecutive = 0;
  let vadSpeechConfirmed = false;
  for (let offset = 0; offset < input.length; offset += frameSamples) {
    const end = Math.min(input.length, offset + frameSamples);
    let frameSquares = 0;
    let framePeak = 0;
    for (let index = offset; index < end; index += 1) {
      const sample = Number.isFinite(input[index]) ? input[index] : 0;
      frameSquares += sample * sample;
      framePeak = Math.max(framePeak, Math.abs(sample));
    }
    const frameRms = Math.sqrt(frameSquares / Math.max(1, end - offset));
    const active = frameRms >= minRms || (framePeak >= 0.018 && frameRms >= minRms * 0.55);
    consecutive = active ? consecutive + 1 : 0;
    if (consecutive >= requiredFrames) {
      vadSpeechConfirmed = true;
      break;
    }
  }

  const passed = rms >= minRms && variance >= minVariance && vadSpeechConfirmed;
  return { passed, rms, variance, peak, vadSpeechConfirmed };
}

export function createControlledLiveNameSenseTrial({
  audio,
  sampleRate,
  protocol,
  trial,
}) {
  const signalQuality = analyzeNameSenseSignal(audio, sampleRate, protocol.signalQuality);
  if (!signalQuality.passed) throw new Error("signal-quality-check-failed");
  if (!trial?.consent) throw new Error("benchmark-consent-required");
  return {
    ...trial,
    mode: "human",
    provenance: protocol.requiredProvenance,
    captureMethod: protocol.requiredCaptureMethod,
    rawAudioRetained: false,
    signalQualityPassed: true,
    vadSpeechConfirmed: signalQuality.vadSpeechConfirmed,
    signalRms: signalQuality.rms,
    signalVariance: signalQuality.variance,
  };
}
