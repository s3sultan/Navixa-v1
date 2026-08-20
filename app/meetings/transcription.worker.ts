/// <reference lib="webworker" />

type WorkerRequest = {
  type: "transcribe";
  audio: Float32Array;
  model: "tiny" | "base";
};

type ModelChoice = {
  id: string;
  dtype: "q8" | "q4";
};

const MODELS: Record<"tiny" | "base", ModelChoice> = {
  tiny: { id: "Xenova/whisper-tiny", dtype: "q8" },
  base: { id: "Xenova/whisper-base", dtype: "q4" },
};

let activeModelKey: "tiny" | "base" | null = null;
let transcriber: ((audio: Float32Array, options: Record<string, unknown>) => Promise<unknown>) | null = null;
let runtimePromise: Promise<{ pipeline: (task: string, model: string, options: Record<string, unknown>) => Promise<typeof transcriber> }> | null = null;

function send(payload: Record<string, unknown>) {
  self.postMessage(payload);
}

async function getTranscriber(model: "tiny" | "base") {
  if (transcriber && activeModelKey === model) return transcriber;
  const choice = MODELS[model];
  send({ type: "state", state: "loading-runtime", message: "جارٍ تنزيل محرك التفريغ لمرة واحدة إلى جهازك…" });
  // يبقى هذا الاستيراد عنوانًا خارجيًا حتى لا تدخل ملفات ONNX/WASM الضخمة في Worker الإنتاجي.
  // لا تُنقل بيانات الصوت إلى هذا العنوان؛ الاستيراد يحمّل المحرك فقط داخل Web Worker للمتصفح.
  runtimePromise ||= import(/* @vite-ignore */ "https://cdn.jsdelivr.net/npm/@huggingface/transformers@3.8.1/+esm") as unknown as Promise<{ pipeline: (task: string, model: string, options: Record<string, unknown>) => Promise<typeof transcriber> }>;
  const runtime = await runtimePromise;
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
    const output = await worker(event.data.audio, {
      language: "arabic",
      task: "transcribe",
      chunk_length_s: 30,
      stride_length_s: 5,
      return_timestamps: true,
    }) as { text?: string; chunks?: Array<{ text?: string; timestamp?: [number | null, number | null] }> };
    const segments = (output.chunks || []).map((chunk) => ({
      start: Number(chunk.timestamp?.[0] || 0),
      end: Number(chunk.timestamp?.[1] || chunk.timestamp?.[0] || 0),
      text: String(chunk.text || "").trim(),
    })).filter((chunk) => chunk.text);
    send({ type: "complete", transcript: String(output.text || "").trim(), segments });
  } catch (error) {
    const detail = error instanceof Error ? error.message : "unknown";
    send({ type: "error", message: "تعذر تشغيل التفريغ المحلي. تحقق من الاتصال لأول تنزيل للنموذج أو من ذاكرة الجهاز.", detail });
  }
});
