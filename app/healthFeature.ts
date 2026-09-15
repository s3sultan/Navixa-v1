// Master switch for the temporarily paused NAVIXA health experience.
// Keep health code and saved user data intact so the feature can be restored later
// by changing this single product flag and redeploying.
export const HEALTH_FEATURE_ENABLED = false;

export const isHealthAlertType = (type: string) => type === "water" || type === "break";

export const isHealthReminderKind = (kind: string) =>
  kind === "water" || kind === "break" || kind === "eye";
