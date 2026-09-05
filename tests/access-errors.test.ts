import test from "node:test";
import assert from "node:assert/strict";
import {ACCESS_ERRORS} from "../app/accessErrors";
test("quota messages direct trial users to Himma without exposing internals",()=>{assert.match(ACCESS_ERRORS.trialQuotaReached,/هِمّة/);assert.doesNotMatch(ACCESS_ERRORS.trialQuotaReached,/API|server|token/i);});
