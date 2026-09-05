import test from "node:test";
import assert from "node:assert/strict";
import {launchTrialPhase} from "../app/launchTrial";
test("trial phases progress before trial reminder ended",()=>{const phases=[new Date("2026-09-04T12:00:00+03:00"),new Date("2026-09-06T12:00:00+03:00"),new Date("2026-09-10T12:00:00+03:00"),new Date("2026-09-13T12:00:00+03:00")].map(launchTrialPhase);assert.deepEqual(phases,["before","trial","reminder","ended"]);});
