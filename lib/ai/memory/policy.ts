import type {
  MemoryKind,
  MemoryWriteInput,
  NavixaMemory,
  NavixaProjectScope,
} from "./types.ts";

const DEFAULT_RETENTION_DAYS: Record<MemoryKind, number | null> = {
  preference: null,
  profile: null,
  goal: 365,
  learning: 365,
  workflow: 180,
  context: 30,
};

const NEVER_INFER_PATTERNS = [
  /password/i,
  /passcode/i,
  /secret/i,
  /api[_ -]?key/i,
  /credit card/i,
  /cvv/i,
  /otp/i,
  /رمز التحقق/i,
  /كلمة المرور/i,
];

export function canReadMemory(
  memory: NavixaMemory,
  userId: string,
  project: NavixaProjectScope,
  includeCore = true,
): boolean {
  if (memory.userId !== userId) return false;
  if (memory.project === project) return true;
  return includeCore && project !== "core" && memory.project === "core";
}

export function isExpiredMemory(memory: NavixaMemory, now = new Date()): boolean {
  if (!memory.expiresAt) return false;
  return new Date(memory.expiresAt).getTime() <= now.getTime();
}

export function shouldRejectMemoryWrite(input: MemoryWriteInput): boolean {
  const content = input.content.trim();
  if (!content) return true;

  if (input.source === "assistant_inferred") {
    return NEVER_INFER_PATTERNS.some((pattern) => pattern.test(content));
  }

  return false;
}

export function resolveMemoryExpiry(
  kind: MemoryKind,
  createdAt = new Date(),
): string | null {
  const days = DEFAULT_RETENTION_DAYS[kind];
  if (days === null) return null;

  const expires = new Date(createdAt);
  expires.setUTCDate(expires.getUTCDate() + days);
  return expires.toISOString();
}

export function normalizeMemoryWrite(input: MemoryWriteInput): MemoryWriteInput {
  return {
    ...input,
    content: input.content.trim().replace(/\s+/g, " "),
    sensitivity: input.sensitivity ?? "standard",
    confidence: clamp01(input.confidence ?? (input.source === "explicit_user" ? 1 : 0.7)),
    salience: clamp01(input.salience ?? 0.5),
    expiresAt: input.expiresAt === undefined ? resolveMemoryExpiry(input.kind) : input.expiresAt,
  };
}

function clamp01(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.min(1, Math.max(0, value));
}
