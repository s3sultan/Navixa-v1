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
        const hub = document.querySelector(".mobile-home-hub");
        if (!hub) return performance.now() >= deadline ? resolve({ found: false }) : setTimeout(inspect, 100);
        resolve({ found: true, visible: getComputedStyle(hub).display !== "none", gateHidden: !document.querySelector(".feature-access-gate") });
      };
      inspect();
    })`);
    assert.equal(accessGate.found, true, "يجب أن يدخل الزائر إلى NAVIXA خلال الفترة المجانية");
    assert.equal(accessGate.visible, true, "يجب أن تظهر الواجهة الرئيسية على الجوال");
    assert.equal(accessGate.gateHidden, true, "يجب ألا تظهر بوابة الحساب خلال الفترة المجانية");

    await navigate(cdp, `${BASE_URL}/today`);
    const todayGate = await evaluate(cdp, `new Promise(resolve => {
      const deadline = performance.now() + 2_500;
      const inspect = () => {
        const hero = document.querySelector(".today-hero");
        if (!hero) return performance.now() >= deadline ? resolve({ found: false }) : setTimeout(inspect, 100);
        resolve({ found: true, visible: getComputedStyle(hero).display !== "none", gateHidden: !document.querySelector(".feature-access-gate") });
      };
      inspect();
    })`);
    assert.equal(todayGate.found, true, "يجب أن تفتح صفحة يومي خلال الفترة المجانية");
    assert.equal(todayGate.visible, true, "يجب أن تظهر صفحة يومي على الجوال");
    assert.equal(todayGate.gateHidden, true, "يجب ألا تظهر بوابة الحساب في يومي خلال الفترة المجانية");

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
        const studio = document.querySelector(".meeting-page");
        if (!studio) return performance.now() >= deadline ? resolve({ found: false }) : setTimeout(inspect, 100);
        resolve({ found: true, visible: getComputedStyle(studio).display !== "none", gateHidden: !document.querySelector(".feature-access-gate") });
      };
      inspect();
    })`);
    assert.equal(meetingGate.found, true, "يجب أن تفتح صفحة الاجتماعات خلال الفترة المجانية");
    assert.equal(meetingGate.visible, true, "يجب أن تظهر أدوات الاجتماعات للزائر خلال الفترة المجانية");
    assert.equal(meetingGate.gateHidden, true, "يجب ألا تظهر بوابة الحساب في الاجتماعات خلال الفترة المجانية");

    console.log(JSON.stringify({
      status: "passed",
      checks: {
        accessGate,
        todayGate,
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
