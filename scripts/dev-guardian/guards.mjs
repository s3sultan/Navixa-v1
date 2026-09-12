import path from "node:path";

function rawPath(value) {
  return String(value || "").replaceAll("\\", "/");
}

function normalizePath(value) {
  const normalized = rawPath(value).replace(/^\.\//, "");
  return path.posix.normalize(normalized).replace(/^\.\//, "");
}

function isUnsafeRepoPath(value) {
  const raw = rawPath(value).trim();
  if (!raw) return true;
  if (raw.startsWith("/") || /^[A-Za-z]:\//.test(raw)) return true;
  const normalized = normalizePath(raw);
  return normalized === ".." || normalized.startsWith("../");
}

function escapeRegex(value) {
  return value.replace(/[|\\{}()[\]^$+?.]/g, "\\$&");
}

function globToRegex(glob) {
  const normalized = normalizePath(glob);
  let pattern = "";
  for (let index = 0; index < normalized.length; index += 1) {
    const character = normalized[index];
    if (character === "*") {
      if (normalized[index + 1] === "*") {
        if (normalized[index + 2] === "/") {
          pattern += "(?:.*/)?";
          index += 2;
        } else {
          pattern += ".*";
          index += 1;
        }
      } else {
        pattern += "[^/]*";
      }
    } else {
      pattern += escapeRegex(character);
    }
  }
  return new RegExp(`^${pattern}$`);
}

function matchesAny(filePath, patterns) {
  const normalized = normalizePath(filePath);
  return patterns.some((pattern) => globToRegex(pattern).test(normalized));
}

export function evaluateScope({ files = [], allowed = ["**"], forbidden = [] } = {}) {
  const uniqueFiles = [...new Set(files.map((value) => String(value || "")).filter(Boolean))];
  const blocked = [];
  const accepted = [];

  for (const originalFile of uniqueFiles) {
    if (isUnsafeRepoPath(originalFile)) {
      blocked.push({ file: rawPath(originalFile), reason: "unsafe-path" });
      continue;
    }
    const file = normalizePath(originalFile);
    if (forbidden.length && matchesAny(file, forbidden)) {
      blocked.push({ file, reason: "forbidden-scope" });
      continue;
    }
    if (!allowed.length || !matchesAny(file, allowed)) {
      blocked.push({ file, reason: "outside-allowed-scope" });
      continue;
    }
    accepted.push(file);
  }

  return {
    allowed: blocked.length === 0,
    accepted,
    blocked,
  };
}

function finiteNumber(value, fallback = 0) {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : fallback;
}

export function evaluateBudget({ limits = {}, usage = {} } = {}) {
  const now = finiteNumber(usage.now, Date.now());
  const startedAt = finiteNumber(usage.startedAt, now);
  const elapsedMs = Math.max(0, now - startedAt);
  const steps = Math.max(0, finiteNumber(usage.steps));
  const costUsd = Math.max(0, finiteNumber(usage.costUsd));
  const tokens = Math.max(0, finiteNumber(usage.tokens));
  const reasons = [];

  if (Number.isFinite(limits.maxSteps) && steps >= limits.maxSteps) reasons.push("max-steps");
  if (Number.isFinite(limits.maxCostUsd) && costUsd >= limits.maxCostUsd) reasons.push("max-cost");
  if (Number.isFinite(limits.maxTokens) && tokens >= limits.maxTokens) reasons.push("max-tokens");
  if (Number.isFinite(limits.maxWallMs) && elapsedMs >= limits.maxWallMs) reasons.push("max-wall-time");

  const remaining = {
    steps: Number.isFinite(limits.maxSteps) ? Math.max(0, limits.maxSteps - steps) : null,
    costUsd: Number.isFinite(limits.maxCostUsd) ? Math.max(0, limits.maxCostUsd - costUsd) : null,
    tokens: Number.isFinite(limits.maxTokens) ? Math.max(0, limits.maxTokens - tokens) : null,
    wallMs: Number.isFinite(limits.maxWallMs) ? Math.max(0, limits.maxWallMs - elapsedMs) : null,
  };

  return {
    allowed: reasons.length === 0,
    reasons,
    usage: { steps, costUsd, tokens, elapsedMs },
    remaining,
  };
}

function normalizeSignature(event) {
  if (!event || typeof event !== "object") return "";
  const action = String(event.action || "").trim().toLowerCase();
  const target = normalizePath(event.target || "");
  const result = String(event.resultSignature || event.result || "").trim().replace(/\s+/g, " ").slice(0, 500);
  const error = String(event.errorSignature || event.error || "").trim().replace(/\s+/g, " ").slice(0, 500);
  return JSON.stringify({ action, target, result, error });
}

function countConsecutiveFailures(events) {
  let count = 0;
  for (let index = events.length - 1; index >= 0; index -= 1) {
    const event = events[index];
    if (event?.ok === false || event?.status === "failed" || event?.error || event?.errorSignature) count += 1;
    else break;
  }
  return count;
}

function detectOscillation(events) {
  if (events.length < 6) return false;
  const recent = events.slice(-6).map((event) => `${String(event.action || "").toLowerCase()}|${normalizePath(event.target || "")}`);
  const [a, b, c, d, e, f] = recent;
  return a === c && c === e && b === d && d === f && a !== b;
}

export function detectStuck(events = [], options = {}) {
  const config = {
    repeatWindow: options.repeatWindow ?? 6,
    repeatThreshold: options.repeatThreshold ?? 3,
    maxConsecutiveFailures: options.maxConsecutiveFailures ?? 3,
    noProgressThreshold: options.noProgressThreshold ?? 4,
  };
  const recent = events.slice(-config.repeatWindow);
  const signatures = recent.map(normalizeSignature).filter(Boolean);
  const counts = new Map();
  for (const signature of signatures) counts.set(signature, (counts.get(signature) || 0) + 1);
  const repeated = [...counts.entries()].find(([, count]) => count >= config.repeatThreshold);
  if (repeated) {
    return { stuck: true, reason: "repeated-identical-action", evidence: { count: repeated[1] } };
  }

  const errors = recent
    .map((event) => String(event?.errorSignature || event?.error || "").trim().replace(/\s+/g, " ").slice(0, 500))
    .filter(Boolean);
  const errorCounts = new Map();
  for (const error of errors) errorCounts.set(error, (errorCounts.get(error) || 0) + 1);
  const repeatedError = [...errorCounts.entries()].find(([, count]) => count >= config.repeatThreshold);
  if (repeatedError) {
    return { stuck: true, reason: "repeated-error", evidence: { count: repeatedError[1], error: repeatedError[0] } };
  }

  const consecutiveFailures = countConsecutiveFailures(events);
  if (consecutiveFailures >= config.maxConsecutiveFailures) {
    return { stuck: true, reason: "consecutive-failures", evidence: { count: consecutiveFailures } };
  }

  if (detectOscillation(events)) {
    return { stuck: true, reason: "oscillation", evidence: { window: 6 } };
  }

  const progressHashes = events
    .slice(-config.noProgressThreshold)
    .map((event) => event?.progressHash)
    .filter((value) => typeof value === "string" && value.length > 0);
  if (progressHashes.length === config.noProgressThreshold && new Set(progressHashes).size === 1) {
    return { stuck: true, reason: "no-progress", evidence: { count: progressHashes.length } };
  }

  return { stuck: false, reason: null, evidence: null };
}

export function guardAgentRun({ files = [], allowed = ["**"], forbidden = [], limits = {}, usage = {}, events = [] } = {}) {
  const scope = evaluateScope({ files, allowed, forbidden });
  const budget = evaluateBudget({ limits, usage });
  const stuck = detectStuck(events);
  const reasons = [
    ...scope.blocked.map((item) => `scope:${item.reason}:${item.file}`),
    ...budget.reasons.map((reason) => `budget:${reason}`),
    ...(stuck.stuck ? [`stuck:${stuck.reason}`] : []),
  ];
  return {
    allowed: reasons.length === 0,
    reasons,
    scope,
    budget,
    stuck,
  };
}

export const DEV_GUARDIAN_DEFAULTS = Object.freeze({
  forbiddenPaths: [
    ".env",
    ".env.*",
    "**/*.pem",
    "**/*.key",
    "**/secrets/**",
  ],
  conservativeBudget: {
    maxSteps: 20,
    maxWallMs: 30 * 60 * 1000,
  },
});
