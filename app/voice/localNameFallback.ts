export type NavixaLocalNameFallback = {
  readonly supported: boolean;
  start: () => Promise<boolean>;
  stop: () => void;
  destroy: () => void;
};

type LocalNameFallbackOptions = {
  onTranscript: (text: string) => void;
  windowSeconds?: number;
  overlapSeconds?: number;
};

type LocalWorkerMessage = {
  type?: string;
  transcript?: string;
};

type AudioContextConstructor = new () => AudioContext;

const TARGET_SAMPLE_RATE = 16_000;
const DEFAULT_WINDOW_SECONDS = 10;
const DEFAULT_OVERLAP_SECONDS = 2;
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

export function createNavixaLocalNameFallback({
  onTranscript,
  windowSeconds = DEFAULT_WINDOW_SECONDS,
  overlapSeconds = DEFAULT_OVERLAP_SECONDS,
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

  const resetBuffer = () => {
    for (const chunk of chunks) chunk.fill(0);
    chunks = [];
    bufferedSamples = 0;
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
    const requiredSamples = Math.max(1, Math.round(sampleRate * windowSeconds));
    if (bufferedSamples < requiredSamples) return;

    const combined = flattenChunks(chunks);
    const overlapSamples = Math.min(combined.length, Math.max(0, Math.round(sampleRate * overlapSeconds)));
    const retained = overlapSamples ? combined.slice(combined.length - overlapSamples) : new Float32Array();
    resetBuffer();
    if (retained.length) {
      chunks.push(retained);
      bufferedSamples = retained.length;
    }

    const audio = resampleNavixaVoiceAudio(combined, sampleRate, TARGET_SAMPLE_RATE);
    combined.fill(0);
    if (!audio.length) return;
    busy = true;
    sequence += 1;
    ensureWorker().postMessage({
      type: "transcribe",
      partId: `name-fallback-${sequence}`,
      audio,
      model: "tiny",
      language: "auto",
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
