import {LAUNCH_TRIAL_END,LAUNCH_TRIAL_REMINDER_START,LAUNCH_TRIAL_START} from "./launchTrial";
import {DEFAULT_PLAN_USAGE_LIMITS} from "./planUsageLimits";

export const LAUNCH_TRIAL_CONFIG={
  start:LAUNCH_TRIAL_START,
  reminderStart:LAUNCH_TRIAL_REMINDER_START,
  end:LAUNCH_TRIAL_END,
  limits:DEFAULT_PLAN_USAGE_LIMITS,
} as const;

// Canonical server-side config seam. Admin/D1 overrides can replace these defaults
// without changing entitlement semantics or client-supplied values.
