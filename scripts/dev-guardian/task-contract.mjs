import path from "node:path";

const SECTION_ALIASES = Object.freeze({
  objective: ["الهدف", "objective"],
  acceptance: ["معايير القبول", "acceptance criteria"],
  risk: ["مستوى الخطورة", "risk"],
  agent: ["الوكيل المقترح", "agent"],
  baseCommit: ["base commit"],
  allowedScope: ["النطاق المسموح", "allowed scope"],
  forbiddenScope: ["الممنوعات", "forbidden scope"],
  budget: ["الميزانية والمهلة", "budget", "budget and timeout"],
});

function clean(value) {
  return String(value || "").trim();
}

function normalizeHeading(value) {
  return clean(value).toLowerCase().replace(/\s+/g, " ");
}

export function parseIssueSections(body = "") {
  const sections = new Map();
  const matches = [...String(body).matchAll(/^###\s+(.+)$/gm)];
  for (let index = 0; index < matches.length; index += 1) {
    const match = matches[index];
    const start = match.index + match[0].length;
    const end = matches[index + 1]?.index ?? String(body).length;
    sections.set(normalizeHeading(match[1]), String(body).slice(start, end).trim());
  }
  return sections;
}

function section(sections, key) {
  for (const alias of SECTION_ALIASES[key] || []) {
    const value = sections.get(normalizeHeading(alias));
    if (value) return value;
  }
  return "";
}

function stripListPrefix(value) {
  return clean(value)
    .replace(/^[-*+]\s+/, "")
    .replace(/^\d+[.)]\s+/, "")
    .replace(/^`|`$/g, "")
    .trim();
}

export function parseList(value = "") {
  return [...new Set(String(value)
    .split(/\r?\n/)
    .map(stripListPrefix)
    .filter((item) => item && item !== "_No response_" && item !== "لا يوجد"))];
}

function normalizeRisk(value) {
  const text = clean(value).toLowerCase();
  if (/حرج|critical/.test(text)) return "critical";
  if (/مرتفع|high/.test(text)) return "high";
  if (/منخفض|low/.test(text)) return "low";
  return "medium";
}

function normalizeAgent(value) {
  const text = clean(value).toLowerCase();
  if (text.includes("codex")) return "Codex";
  if (text.includes("claude")) return "Claude Code";
  if (text.includes("manus")) return "Manus";
  if (text.includes("gemini")) return "Gemini API / AI Studio";
  return "auto";
}

function mentionedPaths(text = "") {
  const results = [];
  for (const match of String(text).matchAll(/`([^`\r\n]+)`/g)) {
    const candidate = match[1].replaceAll("\\", "/").replace(/^\.\//, "");
    if (candidate.includes("://") || path.posix.isAbsolute(candidate) || candidate.startsWith("../")) continue;
    if (candidate.includes("/") || /\.[A-Za-z0-9]+$/.test(candidate)) results.push(path.posix.normalize(candidate));
  }
  return [...new Set(results)];
}

function parseBudget(value = "") {
  const text = clean(value);
  const minute = text.match(/(\d+(?:\.\d+)?)\s*(?:دقيقة|دقائق|minutes?|mins?)/i);
  const hour = text.match(/(\d+(?:\.\d+)?)\s*(?:ساعة|ساعات|hours?|hrs?)/i);
  const cost = text.match(/(?:\$|usd\s*)(\d+(?:\.\d+)?)/i) || text.match(/(\d+(?:\.\d+)?)\s*usd/i);
  const tokens = text.match(/(\d[\d,]*)\s*(?:tokens?|توكن)/i);
  const steps = text.match(/(\d+)\s*(?:steps?|خطوة|خطوات)/i);
  const maxWallMs = minute ? Number(minute[1]) * 60_000 : hour ? Number(hour[1]) * 3_600_000 : null;
  return {
    text,
    maxWallMs,
    maxCostUsd: cost ? Number(cost[1]) : null,
    maxTokens: tokens ? Number(tokens[1].replaceAll(",", "")) : null,
    maxSteps: steps ? Number(steps[1]) : null,
  };
}

function inferSignals(text = "") {
  const value = clean(text).toLowerCase();
  return {
    securitySensitive: /(auth|login|session|otp|permission|admin|billing|payment|secret|webhook|مصادقة|تسجيل دخول|جلسة|صلاحية|إدارة|دفع|فاتورة|سر)/i.test(value),
    uiSensitive: /(ui|ux|layout|visual|responsive|page|design|واجهة|تصميم|صفحة|متجاوب)/i.test(value),
    externalIntegration: /(api|webhook|cloudflare|telegram|moyasar|telr|manus|gemini|integration|تكامل|تيليجرام|ميسر)/i.test(value),
  };
}

function isConcretePath(value) {
  return !/[?*\[\]{}]/.test(value) && !value.endsWith("/");
}

export function selectContextPaths({ contract, repoMap, maxFiles = 18 } = {}) {
  const knownFiles = new Set(Object.keys(repoMap?.dependencyGraph || {}));
  const selected = [];
  const add = (candidate) => {
    if (!candidate || selected.length >= maxFiles || !knownFiles.has(candidate) || selected.includes(candidate)) return;
    selected.push(candidate);
  };

  for (const candidate of contract?.mentionedPaths || []) add(candidate);
  for (const candidate of contract?.allowedScope || []) if (isConcretePath(candidate)) add(candidate);

  const seeds = [...selected];
  for (const seed of seeds) {
    for (const testPath of repoMap?.testLinks?.[seed] || []) add(testPath);
    for (const dependent of repoMap?.reverseDependencyGraph?.[seed] || []) add(dependent);
    for (const dependency of repoMap?.dependencyGraph?.[seed] || []) add(dependency);
  }

  if (!selected.length) {
    for (const hotspot of repoMap?.hotspots || []) add(hotspot.path);
  }
  return selected.slice(0, maxFiles);
}

export function validateTaskContract(contract) {
  const errors = [];
  if (!clean(contract?.objective)) errors.push("missing-objective");
  if (!Array.isArray(contract?.acceptance) || contract.acceptance.length === 0) errors.push("missing-acceptance");
  if (!Array.isArray(contract?.allowedScope) || contract.allowedScope.length === 0) errors.push("missing-allowed-scope");
  if (!clean(contract?.baseCommit)) errors.push("missing-base-commit");
  if ((contract?.allowedScope || []).some((entry) => path.posix.isAbsolute(entry) || entry.startsWith("../"))) errors.push("unsafe-allowed-scope");
  return { valid: errors.length === 0, errors };
}

export function createTaskContract({ issue, repository, baseCommit, repoMap } = {}) {
  const body = String(issue?.body || "");
  const sections = parseIssueSections(body);
  const objective = section(sections, "objective") || clean(issue?.title);
  const acceptance = parseList(section(sections, "acceptance"));
  const risk = normalizeRisk(section(sections, "risk"));
  const requestedAgent = normalizeAgent(section(sections, "agent"));
  const requestedBaseCommit = section(sections, "baseCommit") || "latest-master";
  const allowedScope = parseList(section(sections, "allowedScope"));
  const forbiddenScope = parseList(section(sections, "forbiddenScope"));
  const budget = parseBudget(section(sections, "budget"));
  const paths = mentionedPaths(body);
  const signals = inferSignals(`${issue?.title || ""}\n${body}`);

  const contract = {
    schemaVersion: 1,
    taskId: `github-issue-${Number(issue?.number) || "unknown"}`,
    repository: clean(repository),
    issueNumber: Number(issue?.number) || null,
    issueUrl: clean(issue?.html_url),
    title: clean(issue?.title),
    objective,
    acceptance,
    risk,
    requestedAgent,
    requestedBaseCommit: clean(requestedBaseCommit),
    baseCommit: clean(baseCommit),
    allowedScope,
    forbiddenScope,
    budget,
    mentionedPaths: paths,
    signals: {
      ...signals,
      needsWrite: !/(قراءة فقط|read.?only|review only|مراجعة فقط)/i.test(body),
      filesEstimated: Math.max(paths.length, allowedScope.filter(isConcretePath).length),
    },
  };
  contract.contextPaths = selectContextPaths({ contract, repoMap });
  const validation = validateTaskContract(contract);
  return { ...contract, validation };
}
