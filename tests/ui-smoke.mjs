import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

const APP_PORT = 4174;
const DEBUG_PORT = 9333;
const BASE_URL = `http://[::1]:${APP_PORT}`;
const DEBUG_URL = `http://127.0.0.1:${DEBUG_PORT}`;
const sleep = milliseconds => new Promise(resolve => setTimeout(resolve, milliseconds));

async function waitForUrl(url, label, attempts = 180) {
  let lastError;
  for (let attempt = 0; attempt < attempts; attempt += 1) {
    try {
      const response = await fetch(url, { redirect: "manual" });
      if (response.status > 0) return response;
    } catch (error) { lastError = error; }
    await sleep(350);
  }
  throw new Error(`${label} لم يبدأ: ${lastError instanceof Error ? lastError.message : "انتهت المهلة"}`);
}

function start(command, args, env = {}) {
  return spawn(command, args, { detached: true, stdio: ["ignore", "pipe", "pipe"], env: { ...process.env, ...env } });
}

async function stop(processHandle) {
  if (!processHandle?.pid || processHandle.exitCode !== null) return;
  await new Promise(resolve => {
    const timer = setTimeout(resolve, 1_500);
    processHandle.once("exit", () => { clearTimeout(timer); resolve(); });
    try { process.kill(-processHandle.pid, "SIGTERM"); } catch { resolve(); }
  });
}

async function connectCdp() {
  const pages = await fetch(`${DEBUG_URL}/json/list`).then(response => response.json());
  const page = pages.find(item => item.type === "page");
  assert.ok(page?.webSocketDebuggerUrl, "لم تُعثر نافذة متصفح للاختبار");

  const socket = new WebSocket(page.webSocketDebuggerUrl);
  let sequence = 0;
  const pending = new Map();
  await new Promise((resolve, reject) => {
    socket.addEventListener("open", resolve, { once: true });
    socket.addEventListener("error", reject, { once: true });
  });
  socket.addEventListener("message", event => {
    const message = JSON.parse(event.data);
    const request = pending.get(message.id);
    if (!request) return;
    pending.delete(message.id);
    if (message.error) request.reject(new Error(message.error.message));
    else request.resolve(message.result);
  });

  const call = (method, params = {}) => new Promise((resolve, reject) => {
    const id = ++sequence;
    pending.set(id, { resolve, reject });
    socket.send(JSON.stringify({ id, method, params }));
  });
  return { call, close: () => socket.close() };
}

async function evaluate(cdp, expression) {
  const result = await cdp.call("Runtime.evaluate", { expression, awaitPromise: true, returnByValue: true });
  return result.result.value;
}

async function navigate(cdp, url) {
  await cdp.call("Page.navigate", { url });
  await sleep(1_200);
}

async function main() {
  const profileDir = await mkdtemp(join(tmpdir(), "navixa-ui-profile-"));
  const dev = start("npm", ["run", "dev", "--", "--host", "::1", "--port", String(APP_PORT)]);
  let chrome;
  let cdp;
  const logs = [];
  dev.stderr.on("data", chunk => logs.push(chunk.toString()));

  try {
    await waitForUrl(`${BASE_URL}/`, "خادم NAVIXA المحلي");
    chrome = start(process.env.CHROME_BIN || "chromium", [
      "--headless=new", "--no-sandbox", "--disable-gpu", "--disable-dev-shm-usage",
      "--no-first-run", "--no-default-browser-check", "--remote-allow-origins=*",
      `--remote-debugging-port=${DEBUG_PORT}`, "--remote-debugging-address=127.0.0.1",
      `--user-data-dir=${profileDir}`, "about:blank",
    ]);
    await waitForUrl(`${DEBUG_URL}/json/list`, "متصفح الاختبار", 100);
    cdp = await connectCdp();
    await cdp.call("Emulation.setDeviceMetricsOverride", { width: 390, height: 844, deviceScaleFactor: 1, mobile: true });

    await navigate(cdp, `${BASE_URL}/`);
    const accessGate = await evaluate(cdp, `new Promise(resolve => {
      const deadline = performance.now() + 2_500;
      const inspect = () => {
        const welcome = document.querySelector(".welcome-enter");
        if (welcome) { welcome.click(); return performance.now() >= deadline ? resolve({ found: false }) : setTimeout(inspect, 100); }
        const gate = document.querySelector(".feature-access-gate");
        const action = gate?.querySelector('a[href="/account"], a[href="/plus"]');
        if (!gate || !action) return performance.now() >= deadline ? resolve({ found: false }) : setTimeout(inspect, 100);
        const rect = action.getBoundingClientRect();
        const point = document.elementFromPoint(rect.left + rect.width / 2, rect.top + rect.height / 2);
        resolve({ found: true, visible: getComputedStyle(gate).display !== "none", clickable: point === action || action.contains(point), assistantHidden: !document.querySelector(".assistant-bubble") });
      };
      inspect();
    })`);
    assert.equal(accessGate.found, true, "يجب أن يرى الزائر بوابة الدخول والتفعيل");
    assert.equal(accessGate.visible, true, "يجب أن تكون بوابة الدخول واضحة على الجوال");
    assert.equal(accessGate.clickable, true, "يجب أن يكون رابط الحساب قابلاً للمس");
    assert.equal(accessGate.assistantHidden, true, "يجب ألا تظهر أدوات المساعد قبل الدخول والتفعيل");

    await navigate(cdp, `${BASE_URL}/admin/login`);
    const loginLayout = await evaluate(cdp, `(() => {
      const box = document.querySelector(".google-login-box");
      const mount = box?.querySelector("div");
      if (!box || !mount) return { found: false };
      const boxRect = box.getBoundingClientRect();
      const mountRect = mount.getBoundingClientRect();
      return { found: true, boxWidth: Math.round(boxRect.width), mountWidth: Math.round(mountRect.width), inside: mountRect.width <= boxRect.width + 1, visible: getComputedStyle(box).visibility !== "hidden" && getComputedStyle(box).display !== "none" };
    })()`);
    assert.equal(loginLayout.found, true, "يجب أن يظهر موضع زر Google في شاشة الدخول");
    assert.equal(loginLayout.visible, true, "يجب أن يكون زر الدخول مرئيًا على الجوال");
    assert.equal(loginLayout.inside, true, "يجب ألا يتجاوز زر الدخول عرض البطاقة على الجوال");

    await navigate(cdp, `${BASE_URL}/admin`);
    const adminGuard = await evaluate(cdp, `new Promise(resolve => setTimeout(() => resolve({ path: location.pathname, reason: new URLSearchParams(location.search).get("reason") }), 250))`);
    assert.equal(adminGuard.path, "/admin/login", "يجب أن يعيد حارس الإدارة الزائر غير المصرح إلى صفحة الدخول");
    assert.equal(adminGuard.reason, "session", "يجب أن يوضح الحارس سبب إعادة التوجيه");

    await navigate(cdp, `${BASE_URL}/meetings`);
    const meetingGate = await evaluate(cdp, `new Promise(resolve => {
      const deadline = performance.now() + 2_500;
      const inspect = () => {
        const gate = document.querySelector(".feature-access-gate");
        const action = gate?.querySelector('a[href="/account"], a[href="/plus"]');
        if (!gate || !action) return performance.now() >= deadline ? resolve({ found: false }) : setTimeout(inspect, 100);
        const resources = performance.getEntriesByType("resource").map(entry => entry.name);
        resolve({ found: true, studioHidden: !document.querySelector(".meeting-page"), transcriptionLoaded: resources.some(name => /transcription\.worker|transformers|onnx/i.test(name)), docxLoaded: resources.some(name => /docx/i.test(name)) });
      };
      inspect();
    })`);
    assert.equal(meetingGate.found, true, "يجب أن تحمي صفحة الاجتماعات ببوابة الحساب");
    assert.equal(meetingGate.studioHidden, true, "يجب ألا تظهر أدوات التسجيل قبل الدخول والتفعيل");
    assert.equal(meetingGate.transcriptionLoaded, false, "يجب ألا يحمل محرك التفريغ للزائر غير المفعّل");
    assert.equal(meetingGate.docxLoaded, false, "يجب ألا تحمل مكتبة Word للزائر غير المفعّل");

    console.log(JSON.stringify({
      status: "passed",
      checks: {
        accessGate,
        loginLayout,
        adminGuard,
        meetingGate,
      },
    }, null, 2));
  } finally {
    cdp?.close();
    await stop(chrome);
    await stop(dev);
    await rm(profileDir, { recursive: true, force: true }).catch(() => {});
  }
}

main().then(
  () => process.exit(0),
  error => {
    console.error(error instanceof Error ? error.stack : error);
    process.exit(1);
  },
);
