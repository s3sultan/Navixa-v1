export type BetaUsageFeature = "cloudSync" | "assistantContribution";

export const BETA_USAGE_LIMITS: Record<BetaUsageFeature, number> = {
  cloudSync: 3,
  assistantContribution: 2,
};

const dayKey = () => new Date().toISOString().slice(0, 10);
const storageKey = (feature: BetaUsageFeature) => `navixa-beta-usage-${feature}`;

type StoredUsage = { date: string; count: number };

const readUsage = (feature: BetaUsageFeature): StoredUsage => {
  try {
    const raw = localStorage.getItem(storageKey(feature));
    const parsed = raw ? JSON.parse(raw) as Partial<StoredUsage> : null;
    if (parsed?.date === dayKey() && Number.isFinite(parsed.count)) {
      return { date: dayKey(), count: Math.max(0, Number(parsed.count)) };
    }
  } catch {}
  return { date: dayKey(), count: 0 };
};

export const betaUsageRemaining = (feature: BetaUsageFeature) =>
  Math.max(0, BETA_USAGE_LIMITS[feature] - readUsage(feature).count);

export const consumeBetaUsage = (feature: BetaUsageFeature) => {
  const current = readUsage(feature);
  const limit = BETA_USAGE_LIMITS[feature];
  if (current.count >= limit) return { allowed: false, remaining: 0, limit };
  const next = { date: dayKey(), count: current.count + 1 };
  localStorage.setItem(storageKey(feature), JSON.stringify(next));
  return { allowed: true, remaining: Math.max(0, limit - next.count), limit };
};

export const betaUsageLabel = (feature: BetaUsageFeature) => {
  const remaining = betaUsageRemaining(feature);
  return `متاح ${remaining} من ${BETA_USAGE_LIMITS[feature]} اليوم`;
};
