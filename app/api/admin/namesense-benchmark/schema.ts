export const NAMESENSE_BENCHMARK_ACCENTS = [
  "en-IN", "en-PH", "en-US", "en-GB",
  "ar-GULF", "ar-EG", "ar-SY", "ar-MA", "ar-DZ",
] as const;

export const NAMESENSE_BENCHMARK_DEVICE_CLASSES = ["laptop-built-in", "headset", "phone"] as const;
export const NAMESENSE_BENCHMARK_BROWSERS = ["desktop-chromium", "ios-safari"] as const;
export const NAMESENSE_BENCHMARK_NOISE = ["clean", "office-background", "lecture-echo"] as const;
export const NAMESENSE_BENCHMARK_NAME_IDS = ["sultan", "mohammed", "alharbi"] as const;
export const NAMESENSE_BENCHMARK_LATENCY_BOUNDARY = "client-vad-name-end-to-alert";
export const NAMESENSE_BENCHMARK_PROVENANCE = "controlled-live";
export const NAMESENSE_BENCHMARK_CAPTURE_METHOD = "live-microphone";

type Accent = typeof NAMESENSE_BENCHMARK_ACCENTS[number];
type DeviceClass = typeof NAMESENSE_BENCHMARK_DEVICE_CLASSES[number];
type BrowserClass = typeof NAMESENSE_BENCHMARK_BROWSERS[number];
type NoiseClass = typeof NAMESENSE_BENCHMARK_NOISE[number];
type NameId = typeof NAMESENSE_BENCHMARK_NAME_IDS[number];
type Expected = "hit" | "miss";
type MatchMethod = "exact" | "fuzzy" | "phonetic" | null;

export type NameSenseBenchmarkTrial = {
  id: string;
  mode: "human";
  split: "holdout";
  provenance: typeof NAMESENSE_BENCHMARK_PROVENANCE;
  captureMethod: typeof NAMESENSE_BENCHMARK_CAPTURE_METHOD;
  consent: true;
  rawAudioRetained: false;
  signalQualityPassed: true;
  vadSpeechConfirmed: true;
  signalRms: number;
  signalVariance: number;
  accent: Accent;
  speakerId: string;
  watchedNameId: NameId;
  promptId: string;
  deviceClass: DeviceClass;
  browser: BrowserClass;
  noise: NoiseClass;
  expected: Expected;
  detected: boolean;
  latencyEligible: boolean;
  latencyMs: number | null;
  latencyBoundary: typeof NAMESENSE_BENCHMARK_LATENCY_BOUNDARY;
  matchMethod: MatchMethod;
  matchScore: number | null;
};

const FORBIDDEN_KEYS = new Set([
  "audio", "rawAudio", "audioBlob", "recording", "transcript", "text",
  "email", "phone", "userId", "accountId", "ip", "ipAddress",
  "location", "latitude", "longitude", "deviceId", "hardwareId",
]);

const isObject = (value: unknown): value is Record<string, unknown> => Boolean(value && typeof value === "object" && !Array.isArray(value));
const isIn = <T extends readonly string[]>(values: T, value: unknown): value is T[number] => typeof value === "string" && values.includes(value as T[number]);
const finite = (value: unknown) => typeof value === "number" && Number.isFinite(value);
const shortText = (value: unknown, limit = 100) => typeof value === "string" ? value.trim().slice(0, limit) : "";
const speakerIdPattern = /^anon-[a-z0-9-]{6,80}$/;
const trialIdPattern = /^(?:trial-|[0-9a-f]{8}-)[a-z0-9-]{8,100}$/i;

export function validateNameSenseBenchmarkTrial(value: unknown):
  | { ok: true; trial: NameSenseBenchmarkTrial }
  | { ok: false; error: string } {
  if (!isObject(value)) return { ok: false, error: "بيانات التجربة غير صالحة" };
  for (const key of Object.keys(value)) {
    if (FORBIDDEN_KEYS.has(key)) return { ok: false, error: "يُمنع إرسال الصوت الخام أو البيانات الشخصية" };
  }

  const id = shortText(value.id, 120);
  const speakerId = shortText(value.speakerId, 100);
  const promptId = shortText(value.promptId, 100);
  if (!trialIdPattern.test(id)) return { ok: false, error: "معرّف التجربة غير صالح" };
  if (!speakerIdPattern.test(speakerId)) return { ok: false, error: "معرّف المتحدث يجب أن يكون مجهول الهوية" };
  if (!promptId || !/^[a-z0-9-]{2,100}$/i.test(promptId)) return { ok: false, error: "معرّف الجملة غير صالح" };

  if (value.mode !== "human" || value.split !== "holdout") return { ok: false, error: "لا يُقبل في دليل الاعتماد إلا holdout بشري" };
  if (value.provenance !== NAMESENSE_BENCHMARK_PROVENANCE || value.captureMethod !== NAMESENSE_BENCHMARK_CAPTURE_METHOD) {
    return { ok: false, error: "مصدر التسجيل غير معتمد" };
  }
  if (value.consent !== true || value.rawAudioRetained !== false) return { ok: false, error: "الموافقة وعدم حفظ الصوت الخام شرطان إلزاميان" };
  if (value.signalQualityPassed !== true || value.vadSpeechConfirmed !== true) return { ok: false, error: "فشل فحص جودة الإشارة الصوتية" };

  const signalRms = Number(value.signalRms);
  const signalVariance = Number(value.signalVariance);
  if (!finite(signalRms) || signalRms < 0.0035 || signalRms > 1) return { ok: false, error: "RMS خارج النطاق المقبول" };
  if (!finite(signalVariance) || signalVariance < 1e-6 || signalVariance > 1) return { ok: false, error: "تباين الإشارة خارج النطاق المقبول" };

  if (!isIn(NAMESENSE_BENCHMARK_ACCENTS, value.accent)) return { ok: false, error: "اللهجة غير مدعومة في benchmark" };
  if (!isIn(NAMESENSE_BENCHMARK_DEVICE_CLASSES, value.deviceClass)) return { ok: false, error: "فئة الجهاز غير معتمدة" };
  if (!isIn(NAMESENSE_BENCHMARK_BROWSERS, value.browser)) return { ok: false, error: "المتصفح غير معتمد" };
  if (!isIn(NAMESENSE_BENCHMARK_NOISE, value.noise)) return { ok: false, error: "حالة الضوضاء غير معتمدة" };
  if (!isIn(NAMESENSE_BENCHMARK_NAME_IDS, value.watchedNameId)) return { ok: false, error: "الاسم التجريبي غير معتمد" };
  if (value.expected !== "hit" && value.expected !== "miss") return { ok: false, error: "نوع التجربة غير صالح" };
  if (typeof value.detected !== "boolean" || typeof value.latencyEligible !== "boolean") return { ok: false, error: "نتيجة التجربة غير مكتملة" };
  if (value.latencyBoundary !== NAMESENSE_BENCHMARK_LATENCY_BOUNDARY) return { ok: false, error: "حد قياس زمن الاستجابة غير معتمد" };

  const latencyMs = value.latencyMs === null || value.latencyMs === undefined ? null : Number(value.latencyMs);
  if (latencyMs !== null && (!finite(latencyMs) || latencyMs < 0 || latencyMs > 15_000)) return { ok: false, error: "زمن الاستجابة غير صالح" };
  if (value.latencyEligible && value.detected && latencyMs === null) return { ok: false, error: "زمن الاستجابة مطلوب لهذه التجربة" };

  const method = value.matchMethod === null || value.matchMethod === undefined ? null : value.matchMethod;
  if (method !== null && method !== "exact" && method !== "fuzzy" && method !== "phonetic") return { ok: false, error: "طريقة المطابقة غير صالحة" };
  const score = value.matchScore === null || value.matchScore === undefined ? null : Number(value.matchScore);
  if (score !== null && (!finite(score) || score < 0 || score > 1)) return { ok: false, error: "درجة المطابقة غير صالحة" };

  return {
    ok: true,
    trial: {
      id,
      mode: "human",
      split: "holdout",
      provenance: NAMESENSE_BENCHMARK_PROVENANCE,
      captureMethod: NAMESENSE_BENCHMARK_CAPTURE_METHOD,
      consent: true,
      rawAudioRetained: false,
      signalQualityPassed: true,
      vadSpeechConfirmed: true,
      signalRms,
      signalVariance,
      accent: value.accent,
      speakerId,
      watchedNameId: value.watchedNameId,
      promptId,
      deviceClass: value.deviceClass,
      browser: value.browser,
      noise: value.noise,
      expected: value.expected,
      detected: value.detected,
      latencyEligible: value.latencyEligible,
      latencyMs,
      latencyBoundary: NAMESENSE_BENCHMARK_LATENCY_BOUNDARY,
      matchMethod: method as MatchMethod,
      matchScore: score,
    },
  };
}
