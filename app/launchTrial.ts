export const LAUNCH_TRIAL_START = Date.parse("2026-09-05T00:00:00+03:00");
export const LAUNCH_TRIAL_REMINDERS_START = Date.parse("2026-09-09T00:00:00+03:00");
export const LAUNCH_TRIAL_END = Date.parse("2026-09-12T16:00:00+03:00");

export type NavixaPlan = "free" | "sprint" | "monthly";
export type NavixaCapability = "basic" | "name-listening" | "screen-monitoring" | "heavy-ai" | "session-summary";

export function isLaunchTrialActive(now = Date.now()) {
  return now >= LAUNCH_TRIAL_START && now < LAUNCH_TRIAL_END;
}

export function shouldShowLaunchTrialReminder(now = Date.now()) {
  return now >= LAUNCH_TRIAL_REMINDERS_START && now < LAUNCH_TRIAL_END;
}

export function planAllowsCapability(plan: NavixaPlan, capability: NavixaCapability) {
  if (plan === "monthly") return true;
  if (plan === "sprint") return capability === "basic" || capability === "name-listening" || capability === "screen-monitoring";
  return capability === "basic";
}

export function accessAllowsCapability(plan: NavixaPlan, capability: NavixaCapability, now = Date.now()) {
  if (isLaunchTrialActive(now)) return true;
  return planAllowsCapability(plan, capability);
}
