/// <reference lib="webworker" />

type WorkerRequest = {
  type: "transcribe";
  partId?: string;
  audio: Float32Array;
  model: "tiny" | "base";
  language: "auto" | "ar" | "en";
};

type ModelChoice = { id: string; dtype: "q8" | "q4" };
type TranscriptionOutput = {
  text?: string;
  chunks?: Array<{ text?: string; timestamp?: [number | null, number | null] }>;
};
type TranscriptSegment = { start: number; end: number; text: string };

const MODELS: Record<"tiny" | "base", ModelChoice> = {
  tiny: { id: "Xenova/whisper-tiny", dtype: "q8" },
  base: { id: "Xenova/whisper-base", dtype: "q4" },
};
const LANGUAGES = new Set<WorkerRequest["language"]>(["auto", "ar", "en"]);
const SAMPLE_RATE = 16_000;
const MAX_WINDOW_SECONDS: Record<WorkerRequest["model"], number> = {
  tiny: 180,
  base: 120,
};

let activeModelKey: "tiny" | "base" | null = null;
let transcriber: ((audio: Float32Array, options: Record<string, unknown>) => Promise<unknown>) | null = null;
type TransformersRuntime = {
  pipeline: (task: string, model: string, options: Record<string, unknown>) => Promise<typeof transcriber>;
  env: {
    remoteHost: string;
    remotePathTemplate: string;
    allowRemoteModels: boolean;
    useBrowserCache: boolean;
    backends?: { onnx?: { wasm?: { wasmPaths?: string; numThreads?: number } } };
  };
};
let runtimePromise: Promise<TransformersRuntime> | null = null;

function send(payload: Record<string, unknown>) { self.postMessage(payload); }

function normalizeArabicTranscript(text: string) {
  return text
    .replace(/[\u200B-\u200F\u202A-\u202E\u2066-\u2069]/g, "")
    .replace(/\s+([،؛؟.!])/g, "$1")
    .replace(/([،؛؟.!])(?=[\p{L}\p{N}])/gu, "$1 ")
    .replace(/\s+/g, " ")
    .trim();
}

function collapseAdjacentDuplicateSegments(segments: TranscriptSegment[]) {
  const result: TranscriptSegment[] = [];
  for (const segment of segments) {
    const text = normalizeArabicTranscript(segment.text);
    if (!text) continue;
    const previous = result[result.length - 1];
    const key = text.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, " ").trim();
    const previousKey = previous?.text.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, " ").trim();
    if (previous && key && key === previousKey) {
      previous.end = Math.max(previous.end, segment.end);
      continue;
    }
    result.push({ ...segment, text });
  }
  return result;
}

async function getTranscriber(model: "tiny" | "base") {
  if (transcriber && activeModelKey === model) return transcriber;
  const choice = MODELS[model];
  send({ type: "state", state: "loading-runtime", message: "جارٍ تنزيل محرك التفريغ لمرة واحدة إلى جهازك…" });
  runtimePromise ||= import(/* @vite-ignore */ "https://cdn.jsdelivr.net/npm/@huggingface/transformers@3.8.1/+esm") as unknown as Promise<TransformersRuntime>;
  const runtime = await runtimePromise;
  runtime.env.remoteHost = self.location.origin + "/";
  runtime.env.remotePathTemplate = "api/local-stt-model/{model}/resolve/{revision}/";
  runtime.env.allowRemoteModels = true;
  runtime.env.useBrowserCache = true;
  if (runtime.env.backends?.onnx?.wasm) {
    runtime.env.backends.onnx.wasm.wasmPaths = "https://cdn.jsdelivr.net/npm/onnxruntime-web@1.22.0-dev.20250409-89f8206ba4/dist/";
    runtime.env.backends.onnx.wasm.numThreads = 1;
  }
  send({ type: "state", state: "loading-model", message: "جارٍ تجهيز النموذج المحلي على جهازك…" });
  transcriber = await runtime.pipeline("automatic-speech-recognition", choice.id, {
    dtype: choice.dtype,
    progress_callback: (progress: Record<string, unknown>) => {
      const percentage = typeof progress.progress === "number" ? Math.round(progress.progress) : null;
      send({ type: "progress", file: progress.file || "النموذج", percentage, status: progress.status || "loading" });
    },
  });
  activeModelKey = model;
  return transcriber;
}

function buildTranscriptionOptions(data: WorkerRequest) {
  const options: Record<string, unknown> = {
    task: "transcribe",
    chunk_length_s: data.model === "base" ? 25 : 20,
    stride_length_s: 4,
    return_timestamps: true,
    condition_on_prev_tokens: false,
    no_repeat_ngram_size: 3,
    repetition_penalty: 1.12,
  };
  if (data.language === "ar") options.language = "arabic";
  if (data.language === "en") options.language = "english";
  return options;
}

async function transcribeWindow(
  worker: NonNullable<typeof transcriber>,
  audio: Float32Array,
  options: Record<string, unknown>,
  windowIndex: number,
  totalWindows: number,
) {
  try {
    return await worker(audio, options) as TranscriptionOutput;
  } catch (error) {
    send({
      type: "state",
      state: "retrying-window",
      message: `تعثر مقطع محلي قصير؛ نعيد المحاولة تلقائيًا (${windowIndex + 1}/${totalWindows})…`,
    });
    return await worker(audio, options) as TranscriptionOutput;
  }
}

async function transcribeInWindows(worker: NonNullable<typeof transcriber>, data: WorkerRequest) {
  const maxWindowSamples = MAX_WINDOW_SECONDS[data.model] * SAMPLE_RATE;
  const totalWindows = Math.max(1, Math.ceil(data.audio.length / maxWindowSamples));
  const options = buildTranscriptionOptions(data);
  const rawSegments: TranscriptSegment[] = [];

  for (let windowIndex = 0; windowIndex < totalWindows; windowIndex += 1) {
    const startSample = windowIndex * maxWindowSamples;
    const endSample = Math.min(data.audio.length, startSample + maxWindowSamples);
    const offsetSeconds = startSample / SAMPLE_RATE;
    const durationSeconds = Math.max(0, endSample - startSample) / SAMPLE_RATE;
    const windowAudio = data.audio.slice(startSample, endSample);

    if (totalWindows > 1) {
      send({
        type: "state",
        state: "transcribing-window",
        message: `جارٍ تفريغ الجزء محليًا على دفعات آمنة (${windowIndex + 1}/${totalWindows})…`,
      });
    }

    const output = await transcribeWindow(worker, windowAudio, options, windowIndex, totalWindows);
    const chunks = output.chunks || [];
    if (chunks.length) {
      for (const chunk of chunks) {
        const start = Number(chunk.timestamp?.[0] || 0) + offsetSeconds;
        const end = Number(chunk.timestamp?.[1] ?? chunk.timestamp?.[0] ?? durationSeconds) + offsetSeconds;
        rawSegments.push({ start, end, text: String(chunk.text || "").trim() });
      }
    } else {
      const text = String(output.text || "").trim();
      if (text) rawSegments.push({ start: offsetSeconds, end: offsetSeconds + durationSeconds, text });
    }

    send({
      type: "progress",
      percentage: Math.round(((windowIndex + 1) / totalWindows) * 100),
      status: "transcribing",
    });
  }

  const segments = collapseAdjacentDuplicateSegments(rawSegments);
  const transcript = normalizeArabicTranscript(segments.map((segment) => segment.text).join(" "));
  return { transcript, segments };
}

self.addEventListener("message", async (event: MessageEvent<WorkerRequest>) => {
  // DedicatedWorker messages are tied to the owning document. Some runtimes
  // expose an empty MessageEvent.origin here, so reject only a present mismatch.
  if (event.origin && event.origin !== self.location.origin) return;
  const data = event.data;
  if (data?.type !== "transcribe") return;
  if (!(data.audio instanceof Float32Array)) return;
  if (!Object.hasOwn(MODELS, data.model) || !LANGUAGES.has(data.language)) return;
  try {
    const worker = await getTranscriber(data.model);
    if (!worker) throw new Error("transcriber-unavailable");
    send({ type: "state", state: "transcribing", message: "جارٍ تحويل الصوت إلى نص داخل جهازك…" });
    const result = await transcribeInWindows(worker, data);
    send({ type: "complete", partId: data.partId, transcript: result.transcript, segments: result.segments });
  } catch (error) {
    const detail = error instanceof Error ? error.message : "unknown";
    send({ type: "error", partId: data.partId, message: "تعذر تشغيل التفريغ المحلي بعد إعادة المحاولة. جرّب الجزء مجددًا أو استخدم النموذج الخفيف.", detail });
  }
});
