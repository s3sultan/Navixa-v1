import { normalizeSaudiPhone } from "./notifications/phone";

const TAWKED_BASE_URL = "https://tawked.com/v1";

export type TawkedVerifyEnv = {
  TAWKED_API_KEY?: string;
};

export type TawkedStartResult = {
  ok: boolean;
  id?: string;
  status?: string;
  expiresAt?: string;
  error?: string;
};

export type TawkedCheckResult = {
  ok: boolean;
  verified: boolean;
  status?: string;
  error?: string;
};

async function tawkedRequest<T>(apiKey: string, path: string, body: Record<string, string>) {
  const response = await fetch(`${TAWKED_BASE_URL}${path}`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });
  const payload = await response.json().catch(() => ({})) as T & { error?: string };
  return { response, payload };
}

export async function startTawkedSmsVerification(env: TawkedVerifyEnv, phone: string, lang: "ar" | "en" = "ar"): Promise<TawkedStartResult> {
  const apiKey = env.TAWKED_API_KEY?.trim() || "";
  const normalized = normalizeSaudiPhone(phone);
  if (!apiKey) return { ok: false, error: "tawked_not_configured" };
  if (!normalized) return { ok: false, error: "invalid_saudi_phone" };

  try {
    const { response, payload } = await tawkedRequest<{ id?: string; status?: string; expires_at?: string }>(apiKey, "/verify/start", {
      to: normalized,
      channel: "sms",
      lang,
    });
    if (!response.ok || !payload.id) return { ok: false, error: payload.error || `tawked_http_${response.status}` };
    return { ok: true, id: payload.id, status: payload.status, expiresAt: payload.expires_at };
  } catch {
    return { ok: false, error: "tawked_unreachable" };
  }
}

export async function checkTawkedSmsVerification(env: TawkedVerifyEnv, id: string, code: string): Promise<TawkedCheckResult> {
  const apiKey = env.TAWKED_API_KEY?.trim() || "";
  const verificationId = id.trim();
  const cleanCode = code.replace(/\D/g, "").slice(0, 8);
  if (!apiKey) return { ok: false, verified: false, error: "tawked_not_configured" };
  if (!verificationId || cleanCode.length < 4) return { ok: false, verified: false, error: "invalid_verification" };

  try {
    const { response, payload } = await tawkedRequest<{ verified?: boolean; status?: string }>(apiKey, "/verify/check", {
      id: verificationId,
      code: cleanCode,
    });
    if (!response.ok) return { ok: false, verified: false, error: payload.error || `tawked_http_${response.status}` };
    return { ok: true, verified: payload.verified === true, status: payload.status };
  } catch {
    return { ok: false, verified: false, error: "tawked_unreachable" };
  }
}
