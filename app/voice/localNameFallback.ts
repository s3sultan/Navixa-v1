export type NavixaLocalNameFallback = {
  readonly supported: boolean;
  start: () => Promise<boolean>;
  stop: () => void;
  destroy: () => void;
};

export type NavixaLocalSpeechLanguage = "auto" | "ar" | "en";
export type NavixaVoiceFlushReason = "endpoint" | "window";

type LocalNameFallbackOptions = {
  onTranscript: (text: string) => void;
  windowSeconds?: number;
  overlapSeconds?: number;
  getLanguageHint?: () => NavixaLocalSpeechLanguage;
};

type LocalWorkerMessage = {
  type?: string;
  transcript?: string;
};

type AudioContextConstructor = new () => AudioContext;

const TARGET_SAMPLE_RATE = 16_000;
const DEFAULT_WINDOW_SECONDS = 5;
const DEFAULT_OVERLAP_SECONDS = 1.5;
const DEFAULT_MIN_ENDPOINT_SECONDS = 1;
const DEFAULT_ENDPOINT_SILENCE_SECONDS = 0.4;
const MAX_BUFFER_SECONDS = 18;

export function resampleNavixaVoiceAudio(input: Float32Array, sourceRate: number, targetRate = TARGET_SAMPLE_RATE): Float32Array {
  if (!input.length || !Number.isFinite(sourceRate) || sourceRate <= 0 || targetRate <= 0) return new Float32Array();
  if (sourceRate === targetRate) return new Float32Array(input);
  const ratio = sourceRate / targetRate;
  const outputLength = Math.max(1, Math.floor(input.length / ratio));
  const output = new Float32Array(outputLength);
  for (let index = 0; index < outputLength; index += 1) {
    const position = index * ratio;
    const left = Math.floor(position);
    const right = Math.min(left + 1, input.length - 1);
    const weight = position - left;
    output[index] = input[left] * (1 - weight) + input[right] * weight;
  }
  return output;
}

export function hasNavixaVoiceActivity(
  input: Float32Array,
  sampleRate = TARGET_SAMPLE_RATE,
  frameMs = 20,
  rmsThreshold = 0.0035,
  minSpeechMs = 80,
): boolean {
  if (!input.length || !Number.isFinite(sampleRate) || sampleRate <= 0) return false;
  if (!Number.isFinite(frameMs) || frameMs <= 0 || !Number.isFinite(rmsThreshold) || rmsThreshold <= 0) return false;
  if (!Number.isFinite(minSpeechMs) || minSpeechMs <= 0) return false;

  const frameSamples = Math.max(1, Math.round(sampleRate * frameMs / 1000));
  const requiredFrames = Math.max(1, Math.ceil(minSpeechMs / frameMs));
  let consecutiveActiveFrames = 0;

  for (let offset = 0; offset < input.length; offset += frameSamples) {
    const end = Math.min(input.length, offset + frameSamples);
    let sumSquares = 0;
    let peak = 0;
    for (let index = offset; index < end; index += 1) {
      const raw = input[index];
      const sample = Number.isFinite(raw) ? raw : 0;
      const absolute = Math.abs(sample);
      sumSquares += sample * sample;
      if (absolute > peak) peak = absolute;
    }
    const count = Math.max(1, end - offset);
    const rms = Math.sqrt(sumSquares / count);
    const activeFrame = rms >= rmsThreshold || (peak >= 0.018 && rms >= rmsThreshold * 0.55);
    consecutiveActiveFrames = activeFrame ? consecutiveActiveFrames + 1 : 0;
    if (consecutiveActiveFrames >= requiredFrames) return true;
  }
  return false;
}

export function conditionNavixaVoiceAudio(
  input: Float32Array,
  targetRms = 0.06,
  maxGain = 3,
  peakLimit = 0.96,
): Float32Array {
  if (!input.length) return new Float32Array();
  if (!Number.isFinite(targetRms) || targetRms <= 0 || !Number.isFinite(maxGain) || maxGain <= 0) {
    return new Float32Array(input);
  }

  let sum = 0;
  let validCount = 0;
  for (const raw of input) {
    if (!Number.isFinite(raw)) continue;
    sum += raw;
    validCount += 1;
  }
  const mean = validCount ? sum / validCount : 0;

  let sumSquares = 0;
  let peak = 0;
  for (const raw of input) {
    const sample = (Number.isFinite(raw) ? raw : 0) - mean;
    sumSquares += sample * sample;
    peak = Math.max(peak, Math.abs(sample));
  }
  const rms = Math.sqrt(sumSquares / input.length);
  if (!Number.isFinite(rms) || rms < 1e-6 || peak < 1e-6) return new Float32Array(input.length);

  const requestedGain = targetRms / rms;
  let gain = Math.min(maxGain, Math.max(0.35, requestedGain));
  if (peak * gain > peakLimit) gain = peakLimit / peak;

  const output = new Float32Array(input.length);
  for (let index = 0; index < input.length; index += 1) {
    const raw = Number.isFinite(input[index]) ? input[index] : 0;
    output[index] = Math.max(-peakLimit, Math.min(peakLimit, (raw - mean) * gain));
  }
  return output;
}

export function getNavixaVoiceFlushReason(
  bufferedSamples: number,
  sampleRate: number,
  speechSeen: boolean,
  trailingSilenceSamples: number,
  maxWindowSeconds = DEFAULT_WINDOW_SECONDS,
  minEndpointSeconds = DEFAULT_MIN_ENDPOINT_SECONDS,
  endpointSilenceSeconds = DEFAULT_ENDPOINT_SILENCE_SECONDS,
): NavixaVoiceFlushReason | null {
  if (!Number.isFinite(bufferedSamples) || bufferedSamples <= 0 || !Number.isFinite(sampleRate) || sampleRate <= 0) return null;
  if (!speechSeen) return null;
  const endpointReady = bufferedSamples >= sampleRate * minEndpointSeconds
    && trailingSilenceSamples >= sampleRate * endpointSilenceSeconds;
  if (endpointReady) return "endpoint";
  if (bufferedSamples >= sampleRate * maxWindowSeconds) return "window";
  return null;
}

export function trimNavixaVoiceBuffer(chunks: Float32Array[], sampleRate: number, maxSeconds = MAX_BUFFER_SECONDS): Float32Array[] {
  const maxSamples = Math.max(1, Math.round(sampleRate * maxSeconds));
  let total = chunks.reduce((sum, chunk) => sum + chunk.length, 0);
  while (chunks.length > 1 && total > maxSamples) {
    const removed = chunks.shift();
    total -= removed?.length || 0;
  }
  if (chunks.length === 1 && chunks[0].length > maxSamples) {
    chunks[0] = chunks[0].slice(chunks[0].length - maxSamples);
  }
  return chunks;
}

const flattenChunks = (chunks: Float32Array[]) => {
  const length = chunks.reduce((sum, chunk) => sum + chunk.length, 0);
  const output = new Float32Array(length);
  let offset = 0;
  for (const chunk of chunks) {
    output.set(chunk, offset);
    offset += chunk.length;
  }
  return output;
};

const getAudioContextConstructor = (): AudioContextConstructor | null => {
  if (typeof window === "undefined") return null;
  const browserWindow = window as typeof window & { webkitAudioContext?: AudioContextConstructor };
  return window.AudioContext || browserWindow.webkitAudioContext || null;
};

const safeLanguageHint = (value: unknown): NavixaLocalSpeechLanguage => (
  value === "ar" || value === "en" ? value : "auto"
);

export function createNavixaLocalNameFallback({
  onTranscript,
  windowSeconds = DEFAULT_WINDOW_SECONDS,
  overlapSeconds = DEFAULT_OVERLAP_SECONDS,
  getLanguageHint,
}: LocalNameFallbackOptions): NavixaLocalNameFallback {
  const AudioContextClass = getAudioContextConstructor();
  const supported = Boolean(
    typeof window !== "undefined"
    && navigator.mediaDevices?.getUserMedia
    && typeof Worker !== "undefined"
    && AudioContextClass,
  );

  let destroyed = false;
  let active = false;
  let starting = false;
  let busy = false;
  let stream: MediaStream | null = null;
  let context: AudioContext | null = null;
  let source: MediaStreamAudioSourceNode | null = null;
  let processor: ScriptProcessorNode | null = null;
  let worker: Worker | null = null;
  let chunks: Float32Array[] = [];
  let bufferedSamples = 0;
  let sequence = 0;
  let speechSeen = false;
  let trailingSilenceSamples = 0;

  const resetActivity = () => {
    speechSeen = false;
    trailingSilenceSamples = 0;
  };

  const resetBuffer = () => {
    for (const chunk of chunks) chunk.fill(0);
    chunks = [];
    bufferedSamples = 0;
    resetActivity();
  };

  const refreshBufferedSamples = () => {
    bufferedSamples = chunks.reduce((sum, chunk) => sum + chunk.length, 0);
  };

  const ensureWorker = () => {
    if (worker) return worker;
    worker = new Worker(new URL("../meetings/transcription.worker.ts", import.meta.url), { type: "module" });
    worker.onmessage = (event: MessageEvent<LocalWorkerMessage>) => {
      if (destroyed) return;
      if (event.data?.type !== "complete" && event.data?.type !== "error") return;
      busy = false;
      if (event.data.type === "complete") {
        const transcript = typeof event.data.transcript === "string" ? event.data.transcript.trim() : "";
        if (transcript) onTranscript(transcript);
      }
      queueMicrotask(flushIfReady);
    };
    worker.onerror = () => {
      busy = false;
    };
    return worker;
  };

  const flushIfReady = () => {
    if (destroyed || !active || busy || !context) return;
    const sampleRate = context.sampleRate;
    const hardWindowSamples = Math.max(1, Math.round(sampleRate * windowSeconds));
    if (!speechSeen && bufferedSamples >= hardWindowSamples) {
      resetBuffer();
      return;
    }

    const flushReason = getNavixaVoiceFlushReason(
      bufferedSamples,
      sampleRate,
      speechSeen,
      trailingSilenceSamples,
      windowSeconds,
    );
    if (!flushReason) return;

    const combined = flattenChunks(chunks);
    const overlapSamples = flushReason === "window"
      ? Math.min(combined.length, Math.max(0, Math.round(sampleRate * overlapSeconds)))
      : 0;
    const retained = overlapSamples ? combined.slice(combined.length - overlapSamples) : new Float32Array();
    resetBuffer();
    if (retained.length) {
      chunks.push(retained);
      bufferedSamples = retained.length;
    }

    const resampled = resampleNavixaVoiceAudio(combined, sampleRate, TARGET_SAMPLE_RATE);
    combined.fill(0);
    if (!resampled.length) return;
    if (!hasNavixaVoiceActivity(resampled, TARGET_SAMPLE_RATE)) {
      resampled.fill(0);
      return;
    }

    const audio = conditionNavixaVoiceAudio(resampled);
    resampled.fill(0);
    if (!audio.length) return;

    busy = true;
    sequence += 1;
    let language: NavixaLocalSpeechLanguage = "auto";
    try {
      language = safeLanguageHint(getLanguageHint?.());
    } catch {
      language = "auto";
    }
    ensureWorker().postMessage({
      type: "transcribe",
      partId: `name-fallback-${sequence}`,
      audio,
      model: "tiny",
      language,
    }, [audio.buffer]);
  };

  const stop = () => {
    active = false;
    starting = false;
    busy = false;
    if (processor) {
      processor.onaudioprocess = null;
      try { processor.disconnect(); } catch {}
      processor = null;
    }
    if (source) {
      try { source.disconnect(); } catch {}
      source = null;
    }
    stream?.getTracks().forEach((track) => track.stop());
    stream = null;
    if (context && context.state !== "closed") void context.close().catch(() => undefined);
    context = null;
    worker?.terminate();
    worker = null;
    resetBuffer();
  };

  return {
    supported,
    start: async () => {
      if (!supported || destroyed || active || starting || !AudioContextClass) return false;
      starting = true;
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
          video: false,
        });
        if (destroyed) {
          stream.getTracks().forEach((track) => track.stop());
          stream = null;
          return false;
        }
        context = new AudioContextClass();
        if (context.state === "suspended") await context.resume().catch(() => undefined);
        source = context.createMediaStreamSource(stream);
        processor = context.createScriptProcessor(4096, 1, 1);
        processor.onaudioprocess = (event) => {
          if (!active || destroyed || !context) return;
          const input = event.inputBuffer.getChannelData(0);
          const copy = new Float32Array(input);
          const chunkHasVoice = hasNavixaVoiceActivity(copy, context.sampleRate, 20, 0.0035, 60);
          if (chunkHasVoice) {
            speechSeen = true;
            trailingSilenceSamples = 0;
          } else if (speechSeen) {
            trailingSilenceSamples += copy.length;
          }
          chunks.push(copy);
          bufferedSamples += copy.length;
          trimNavixaVoiceBuffer(chunks, context.sampleRate, MAX_BUFFER_SECONDS);
          refreshBufferedSamples();
          for (let channel = 0; channel < event.outputBuffer.numberOfChannels; channel += 1) {
            event.outputBuffer.getChannelData(channel).fill(0);
          }
          flushIfReady();
        };
        source.connect(processor);
        processor.connect(context.destination);
        active = true;
        starting = false;
        return true;
      } catch {
        stop();
        return false;
      }
    },
    stop,
    destroy: () => {
      if (destroyed) return;
      destroyed = true;
      stop();
    },
  };
}
