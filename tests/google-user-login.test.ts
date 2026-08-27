import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";
import { verifyGoogleCredential } from "../app/api/auth/googleIdentity.ts";
import { POST as googleUserLogin } from "../app/api/account/google/route.ts";

const clientId = "876266145464-i4pigjbevro3ki0d0lj0gds6geivecvb.apps.googleusercontent.com";
const verifiedClaim = { aud: clientId, email: "member@example.com", email_verified: true, iss: "https://accounts.google.com" };

test("دخول Google للمستخدم يقبل البريد الموثق فقط ولا يقيّده ببريد المدير", async () => {
  const result = await verifyGoogleCredential("credential", async () => new Response(JSON.stringify(verifiedClaim), { status: 200 }));
  assert.deepEqual(result, { ok: true, email: "member@example.com" });
});

test("دخول Google يرفض حسابًا غير موثق أو موجهًا إلى عميل OAuth آخر", async () => {
  const unverified = await verifyGoogleCredential("credential", async () => new Response(JSON.stringify({ ...verifiedClaim, email_verified: false }), { status: 200 }));
  const wrongAudience = await verifyGoogleCredential("credential", async () => new Response(JSON.stringify({ ...verifiedClaim, aud: "other-client" }), { status: 200 }));
  assert.equal(unverified.ok, false);
  assert.equal(wrongAudience.ok, false);
});

test("مسار دخول Google للمستخدم يتطلب المصدر الموثوق وينشئ جلسة خادمية من البريد المؤكد فقط", async () => {
  const route = await readFile(new URL("../app/api/account/google/route.ts", import.meta.url), "utf8");
  assert.match(route, /trustedUserMutation\(request\)/);
  assert.match(route, /verifyGoogleCredential/);
  assert.match(route, /createUserSession\(database, userId\)/);
  assert.doesNotMatch(route, /body\.email/);
});

test("مسار دخول Google للمستخدم يرفض طلبًا خارج أصل NAVIXA قبل قراءة أي اعتماد", async () => {
  const response = await googleUserLogin(new Request("https://navixa.example/api/account/google", {
    method: "POST",
    headers: { origin: "https://attacker.example", "content-type": "application/json" },
    body: JSON.stringify({ credential: "untrusted" }),
  }));
  assert.equal(response.status, 403);
});

test("مسارات رمز البريد تدمج بيئة Cloudflare مع process.env ولا تفقد أسرار nodejs_compat", async () => {
  const requestRoute = await readFile(new URL("../app/api/account/code/request/route.ts", import.meta.url), "utf8");
  const verifyRoute = await readFile(new URL("../app/api/account/code/verify/route.ts", import.meta.url), "utf8");
  assert.match(requestRoute, /\.\.\.processEnv/);
  assert.match(requestRoute, /\.\.\.bindings/);
  assert.match(verifyRoute, /\.\.\.processEnv/);
  assert.match(verifyRoute, /\.\.\.bindings/);
});
