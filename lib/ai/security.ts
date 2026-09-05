import type { AiRouteRequest } from "./router";

const MAX_TEXT_LENGTH = 40_000;
const SECRET_PATTERNS = [
  /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/i,
  /\b(?:api[_-]?key|secret|password)\s*[:=]\s*[^\s]+/i,
];

export function validateAiInput(text: string): { ok: boolean; reason?: string } {
  if (!text.trim()) return { ok: false, reason: "empty-input" };
  if (text.length > MAX_TEXT_LENGTH) return { ok: false, reason: "input-too-large" };
  if (SECRET_PATTERNS.some((pattern) => pattern.test(text))) return { ok: false, reason: "possible-secret" };
  return { ok: true };
}

export function sanitizeAiMetadata(request: AiRouteRequest) {
  return {
    project: request.project,
    task: request.task,
    childMode: Boolean(request.childMode),
    advanced: Boolean(request.requiresAdvancedReasoning),
  };
}
