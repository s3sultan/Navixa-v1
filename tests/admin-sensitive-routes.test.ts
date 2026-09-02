import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";

async function source(path: string) {
  return readFile(new URL(`../${path}`, import.meta.url), "utf8");
}

test("billing settings requires same-origin only for mutations", async () => {
  const code = await source("app/api/admin/billing-settings/route.ts");
  assert.match(code, /async function allowed\(request:Request,requireSameOrigin=false\)/);
  assert.match(code, /if\(requireSameOrigin&&!isTrustedSameOriginRequest\(request\)\)return false/);
  assert.match(code, /export async function GET\(request:Request\)[\s\S]*?!await allowed\(request\)/);
  assert.match(code, /export async function POST\(request:Request\)[\s\S]*?!await allowed\(request,true\)/);
});

test("discount codes requires same-origin only for mutations", async () => {
  const code = await source("app/api/admin/discount-codes/route.ts");
  assert.match(code, /async function allowed\(request:Request,requireSameOrigin=false\)/);
  assert.match(code, /if\(requireSameOrigin&&!isTrustedSameOriginRequest\(request\)\)return false/);
  assert.match(code, /export async function GET\(request:Request\)[\s\S]*?!await allowed\(request\)/);
  assert.match(code, /export async function POST\(request:Request\)[\s\S]*?!await allowed\(request,true\)/);
});
