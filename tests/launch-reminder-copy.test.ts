import test from "node:test";
import assert from "node:assert/strict";
import {LAUNCH_TRIAL_COPY} from "../app/launchTrialCopy";
test("reminder is informative rather than alarming",()=>{assert.match(LAUNCH_TRIAL_COPY.title,/التجريبية المجانية مستمرة/);assert.doesNotMatch(Object.values(LAUNCH_TRIAL_COPY).join(" "),/تحذير|فورًا|آخر فرصة/);});
