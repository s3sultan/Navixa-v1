import fs from "node:fs";
import test from "node:test";
import assert from "node:assert/strict";
test("pricing keeps legal and support links after access redesign",()=>{const source=fs.readFileSync("app/pricing/page.tsx","utf8");for(const href of ["/terms","/privacy","/refunds","/support"])assert.match(source,new RegExp(`href="${href}"`));});
