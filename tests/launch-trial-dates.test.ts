import test from "node:test";
import assert from "node:assert/strict";
import {LAUNCH_TRIAL_PUBLIC_DATES} from "../app/launchTrialDates";
test("public launch dates match approved Saudi schedule",()=>{assert.match(LAUNCH_TRIAL_PUBLIC_DATES.reminderLabel,/الأربعاء 9 سبتمبر/);assert.match(LAUNCH_TRIAL_PUBLIC_DATES.endLabel,/السبت 12 سبتمبر 2026 الساعة 4:00 م/);});
