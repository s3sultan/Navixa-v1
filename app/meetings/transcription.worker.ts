/// <reference lib="webworker" />

type WorkerRequest = {
  type: "transcribe";
  partId?: string;
  audio: Float32Array;
  model: "tiny" | "base";
  language: "auto" | "ar" | "en";
};

type ModelChoice = { id: string; dtype: "q8" | "q4" };

const MODELS: Record<"tiny" | "base", ModelChoice> = {
  tiny: { id: "Xenova/whisper-tiny", dtype: "q8" },
  base: { id: "Xenova/whisper-base", dtype: "q4" },
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

function collapseAdjacentDuplicateSegments(segments: Array<{ start: number; end: number; text: string }>) {
  const result: typeof segments = [];
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

self.addEventListener("message", async (event: MessageEvent<WorkerRequest>) => {
  if (event.data?.type !== "transcribe") return;
  try {
    const worker = await getTranscriber(event.data.model);
    send({ type: "state", state: "transcribing", message: "جارٍ تحويل الصوت إلى نص داخل جهازك…" });
    const options: Record<string, unknown> = {
      task: "transcribe",
      chunk_length_s: event.data.model === "base" ? 25 : 20,
      stride_length_s: 4,
      return_timestamps: true,
      condition_on_prev_tokens: false,
      no_repeat_ngram_size: 3,
      repetition_penalty: 1.12,
    };
    if (event.data.language === "ar") options.language = "arabic";
    if (event.data.language === "en") options.language = "english";
    const output = await worker(event.data.audio, options) as { text?: string; chunks?: Array<{ text?: string; timestamp?: [number | null, number | null] }> };
    const rawSegments = (output.chunks || []).map((chunk) => ({
      start: Number(chunk.timestamp?.[0] || 0),
      end: Number(chunk.timestamp?.[1] || chunk.timestamp?.[0] || 0),
      text: String(chunk.text || "").trim(),
    }));
    const segments = collapseAdjacentDuplicateSegments(rawSegments);
    const transcriptFromSegments = segments.map((segment) => segment.text).join(" ");
    const transcript = normalizeArabicTranscript(transcriptFromSegments || String(output.text || ""));
    send({ type: "complete", partId: event.data.partId, transcript, segments });
  } catch (error) {
    const detail = error instanceof Error ? error.message : "unknown";
    send({ type: "error", partId: event.data.partId, message: "تعذر تشغيل التفريغ المحلي. تحقق من الاتصال لأول تنزيل للنموذج أو من ذاكرة الجهاز.", detail });
  }
});
