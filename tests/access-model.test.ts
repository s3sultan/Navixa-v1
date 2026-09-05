import test from "node:test";
import assert from "node:assert/strict";
import {NAVIXA_ACCESS_MODEL} from "../app/accessModel";

test("public access model matches approved product split",()=>{
  assert.equal(NAVIXA_ACCESS_MODEL.trial.scope,"full-limited");
  assert.match(NAVIXA_ACCESS_MODEL.azm.description,/مراقبة الشاشة \+ نداء الاسم/);
  assert.equal(NAVIXA_ACCESS_MODEL.himma.scope,"full");
});
