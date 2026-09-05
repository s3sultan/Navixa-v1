import test from "node:test";
import assert from "node:assert/strict";
import {ACCESS_NO_STORE_HEADERS} from "../app/api/access/_shared";
test("access APIs default to no-store",()=>{assert.equal(ACCESS_NO_STORE_HEADERS["Cache-Control"],"no-store");});
