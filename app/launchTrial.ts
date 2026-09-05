export const NAVIXA_TIME_ZONE = "Asia/Riyadh";
export const LAUNCH_TRIAL_START = "2026-09-05T00:00:00+03:00";
export const LAUNCH_TRIAL_REMINDER_START = "2026-09-09T00:00:00+03:00";
export const LAUNCH_TRIAL_END = "2026-09-12T16:00:00+03:00";

export type LaunchTrialPhase = "before" | "trial" | "reminder" | "ended";

export function launchTrialPhase(now = new Date()): LaunchTrialPhase {
  const time = now.getTime();
  if (time < Date.parse(LAUNCH_TRIAL_START)) return "before";
  if (time >= Date.parse(LAUNCH_TRIAL_END)) return "ended";
  if (time >= Date.parse(LAUNCH_TRIAL_REMINDER_START)) return "reminder";
  return "trial";
}

export function launchTrialRemainingMs(now = new Date()) {
  return Math.max(0, Date.parse(LAUNCH_TRIAL_END) - now.getTime());
}
