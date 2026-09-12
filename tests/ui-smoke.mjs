import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

const APP_PORT = 4174;
const DEBUG_PORT = 9333;
const BASE_URL = `http://[::1]:${APP_PORT}`;
const DEBUG_URL = `http://127.0.0.1:${DEBUG_PORT}`;
const vinextCli = join(process.cwd(), "node_modules", "vinext", "dist", "cli.js");
const sleep = milliseconds => new Promise(resolve => setTimeout(resolve, milliseconds));

function browserCommand() {
  if (process.env.CHROME_BIN) return process.env.CHROME_BIN;
  if (process.platform !== "win32") return "chromium";
  const candidates = [
    "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
    "C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe",
    "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe",
    "C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe",
  ];
  return candidates.find(existsSync) || "chromium";
}

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
  return spawn(command, args, {
    detached: true,
    windowsHide: true,
    stdio: ["ignore", "pipe", "pipe"],
    env: { ...process.env, ...env },
  });
}

async function windowsListenerPid(port) {
  if (process.platform !== "win32") return null;
  return new Promise(resolve => {
    const finder = spawn("powershell.exe", [
      "-NoProfile",
      "-NonInteractive",
      "-Command",
      `(Get-NetTCPConnection -State Listen -LocalPort ${port} -ErrorAction SilentlyContinue | Select-Object -First 1 -ExpandProperty OwningProcess)`,
    ], { windowsHide: true, stdio: ["ignore", "pipe", "ignore"] });
    let output = "";
    finder.stdout.on("data", chunk => { output += chunk.toString(); });
    finder.once("close", () => {
      const pid = Number.parseInt(output.trim(), 10);
      resolve(Number.isInteger(pid) && pid > 0 ? pid : null);
    });
    finder.once("error", () => resolve(null));
  });
}

async function stop(processHandle, listenerPid = null) {
  if (process.platform === "win32") {
    const activeParentPid = processHandle?.exitCode === null ? processHandle.pid : null;
    const targets = [...new Set([activeParentPid, listenerPid].filter(pid => Number.isInteger(pid) && pid > 0))];
    await Promise.all(targets.map(pid => new Promise(resolve => {
      const killer = spawn("powershell.exe", [
        "-NoProfile",
        "-NonInteractive",
        "-Command",
        `Stop-Process -Id ${pid} -Force -ErrorAction SilentlyContinue`,
      ], { stdio: "ignore", windowsHide: true });
      killer.once("exit", resolve);
      killer.once("error", resolve);
    })));
    return;
  }
  if (!processHandle?.pid || processHandle.exitCode !== null) return;
  await new Promise(resolve => {
    const timer = setTimeout(resolve, 1_500);
    processHandle.once("exit", () => { clearTimeout(timer); resolve(); });
    try {
      process.kill(-processHandle.pid, "SIGTERM");
    } catch { resolve(); }
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
  await sleep(250);
  const readiness = await evaluate(cdp, `new Promise(resolve => {
    const deadline = performance.now() + 15_000;
    const inspect = () => {
      if (document.readyState !== "loading" && document.body) return resolve({ ready: true, state: document.readyState });
      if (performance.now() >= deadline) return resolve({ ready: false, state: document.readyState });
      setTimeout(inspect, 100);
    };
    inspect();
  })`);
  assert.equal(readiness.ready, true, `لم تجهز الصفحة ${url}: ${JSON.stringify(readiness)}`);
}

async function inspectUiLab(cdp, { width, height, mobile }) {
  await cdp.call("Emulation.setDeviceMetricsOverride", { width, height, deviceScaleFactor: 1, mobile });
  await navigate(cdp, `${BASE_URL}/ui-lab`);
  return evaluate(cdp, `(() => {
    const sidebar = document.querySelector('aside[aria-label="التنقل الرئيسي"]');
    const bottomNav = document.querySelector('nav[aria-label="التنقل السريع"]');
    const menuButton = document.querySelector('button[aria-controls="navixa-mobile-navigation"]');
    const heading = document.querySelector('main h1');
    const sidebarRect = sidebar?.getBoundingClientRect();
    return {
      heading: heading?.textContent?.trim() || "",
      innerWidth,
      scrollWidth: document.documentElement.scrollWidth,
      hasHorizontalOverflow: document.documentElement.scrollWidth > innerWidth + 1,
      sidebarDisplay: sidebar ? getComputedStyle(sidebar).display : null,
      sidebarWidth: sidebarRect ? Math.round(sidebarRect.width) : 0,
      bottomNavDisplay: bottomNav ? getComputedStyle(bottomNav).display : null,
      menuDisplay: menuButton ? getComputedStyle(menuButton).display : null,
      cardCount: document.querySelectorAll('main section').length,
    };
  })()`);
}

async function main() {
  const profileDir = await mkdtemp(join(tmpdir(), "navixa-ui-profile-"));
  const dev = start(process.execPath, [vinextCli, "dev", "--host", "::1", "--port", String(APP_PORT)]);
  let chrome;
  let cdp;
  let devListenerPid = null;
  let browserListenerPid = null;
  const logs = [];
  dev.stdout.on("data", chunk => logs.push(chunk.toString()));
  dev.stderr.on("data", chunk => logs.push(chunk.toString()));
  dev.on("error", error => logs.push(`\n${error.message}\n`));

  try {
    await waitForUrl(`${BASE_URL}/`, "خادم NAVIXA المحلي").catch(error => {
      throw new Error(`${error instanceof Error ? error.message : error}\n${logs.join("").slice(-4000)}`);
    });
    devListenerPid = await windowsListenerPid(APP_PORT);
    chrome = start(browserCommand(), [
      "--headless=new", "--no-sandbox", "--disable-gpu", "--disable-dev-shm-usage",
      "--no-first-run", "--no-default-browser-check", "--remote-allow-origins=*",
      `--remote-debugging-port=${DEBUG_PORT}`, "--remote-debugging-address=127.0.0.1",
      `--user-data-dir=${profileDir}`, "about:blank",
    ]);
    const browserLogs = [];
    chrome.stdout.on("data", chunk => browserLogs.push(chunk.toString()));
    chrome.stderr.on("data", chunk => browserLogs.push(chunk.toString()));
    chrome.on("error", error => browserLogs.push(`\n${error.message}\n`));
    await waitForUrl(`${DEBUG_URL}/json/list`, "متصفح الاختبار", 100).catch(error => {
      throw new Error(`${error instanceof Error ? error.message : error}\n${browserLogs.join("").slice(-4000)}`);
    });
    browserListenerPid = await windowsListenerPid(DEBUG_PORT);
    cdp = await connectCdp();
    await cdp.call("Emulation.setDeviceMetricsOverride", { width: 390, height: 844, deviceScaleFactor: 1, mobile: true });

    await navigate(cdp, `${BASE_URL}/`);
    const accessGate = await evaluate(cdp, `new Promise(resolve => {
      const deadline = performance.now() + 2_500;
      const inspect = () => {
        const welcome = document.querySelector(".welcome-enter");
        if (welcome) { welcome.click(); return performance.now() >= deadline ? resolve({ found: false, url: location.href, readyState: document.readyState, title: document.title, body: document.body?.innerText.slice(0, 500) || "" }) : setTimeout(inspect, 100); }
        const hub = document.querySelector(".mobile-home-hub");
        if (!hub) return performance.now() >= deadline ? resolve({ found: false, url: location.href, readyState: document.readyState, title: document.title, body: document.body?.innerText.slice(0, 500) || "" }) : setTimeout(inspect, 100);
        resolve({ found: true, visible: getComputedStyle(hub).display !== "none", gateHidden: !document.querySelector(".feature-access-gate") });
      };
      inspect();
    })`);
    assert.equal(accessGate.found, true, `يجب أن يدخل الزائر إلى NAVIXA خلال الفترة المجانية: ${JSON.stringify(accessGate)}`);
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

    const uiLabMobile = await inspectUiLab(cdp, { width: 390, height: 844, mobile: true });
    assert.equal(uiLabMobile.hasHorizontalOverflow, false, `يجب ألا يظهر overflow أفقي في UI Lab على الجوال: ${JSON.stringify(uiLabMobile)}`);
    assert.equal(uiLabMobile.sidebarDisplay, "none", "يجب إخفاء Sidebar على الجوال");
    assert.notEqual(uiLabMobile.bottomNavDisplay, "none", "يجب إظهار Bottom Navigation على الجوال");
    assert.notEqual(uiLabMobile.menuDisplay, "none", "يجب إظهار زر قائمة الجوال");
    assert.ok(uiLabMobile.cardCount >= 5, "يجب أن تعرض معاينة الجوال البطاقات الأساسية");

    await evaluate(cdp, `document.querySelector('button[aria-controls="navixa-mobile-navigation"]')?.click()`);
    const uiLabDrawer = await evaluate(cdp, `new Promise(resolve => {
      const deadline = performance.now() + 1_500;
      const inspect = () => {
        const drawer = document.getElementById("navixa-mobile-navigation");
        if (!drawer && performance.now() < deadline) return setTimeout(inspect, 50);
        const rect = drawer?.getBoundingClientRect();
        resolve({
          found: Boolean(drawer),
          role: drawer?.getAttribute("role") || null,
          modal: drawer?.getAttribute("aria-modal") || null,
          width: rect ? Math.round(rect.width) : 0,
          bottomGap: rect ? Math.round(innerHeight - rect.bottom) : null,
        });
      };
      inspect();
    })`);
    assert.equal(uiLabDrawer.found, true, "يجب أن تفتح قائمة الجوال كـDrawer");
    assert.equal(uiLabDrawer.role, "dialog", "يجب أن يحمل Drawer دلالة dialog");
    assert.equal(uiLabDrawer.modal, "true", "يجب أن يعلن Drawer أنه modal");
    assert.ok(uiLabDrawer.width >= 380, `يجب أن يستخدم Drawer عرض الجوال تقريبًا: ${JSON.stringify(uiLabDrawer)}`);
    assert.ok(Math.abs(uiLabDrawer.bottomGap ?? 99) <= 1, "يجب أن يلتصق Drawer بأسفل الشاشة على الجوال");
    await cdp.call("Input.dispatchKeyEvent", { type: "keyDown", key: "Escape", code: "Escape" });
    await cdp.call("Input.dispatchKeyEvent", { type: "keyUp", key: "Escape", code: "Escape" });
    await sleep(100);
    const drawerClosed = await evaluate(cdp, `!document.getElementById("navixa-mobile-navigation")`);
    assert.equal(drawerClosed, true, "يجب أن يغلق Drawer بزر Escape");

    const uiLabTablet = await inspectUiLab(cdp, { width: 820, height: 900, mobile: false });
    assert.equal(uiLabTablet.hasHorizontalOverflow, false, `يجب ألا يظهر overflow أفقي في UI Lab على التابلت: ${JSON.stringify(uiLabTablet)}`);
    assert.notEqual(uiLabTablet.sidebarDisplay, "none", "يجب إظهار شريط جانبي مختصر على التابلت");
    assert.ok(uiLabTablet.sidebarWidth >= 70 && uiLabTablet.sidebarWidth <= 110, `عرض شريط التابلت غير متوقع: ${JSON.stringify(uiLabTablet)}`);
    assert.equal(uiLabTablet.bottomNavDisplay, "none", "يجب إخفاء Bottom Navigation على التابلت");
    assert.equal(uiLabTablet.menuDisplay, "none", "يجب إخفاء زر قائمة الجوال على التابلت");

    const uiLabDesktop = await inspectUiLab(cdp, { width: 1440, height: 1000, mobile: false });
    assert.equal(uiLabDesktop.hasHorizontalOverflow, false, `يجب ألا يظهر overflow أفقي في UI Lab على سطح المكتب: ${JSON.stringify(uiLabDesktop)}`);
    assert.notEqual(uiLabDesktop.sidebarDisplay, "none", "يجب إظهار Sidebar كامل على سطح المكتب");
    assert.ok(uiLabDesktop.sidebarWidth >= 240, `يجب أن يكون Sidebar سطح المكتب كامل العرض: ${JSON.stringify(uiLabDesktop)}`);
    assert.equal(uiLabDesktop.bottomNavDisplay, "none", "يجب إخفاء Bottom Navigation على سطح المكتب");
    assert.equal(uiLabDesktop.menuDisplay, "none", "يجب إخفاء زر قائمة الجوال على سطح المكتب");

    console.log(JSON.stringify({
      status: "passed",
      checks: {
        accessGate,
        todayGate,
        loginLayout,
        adminGuard,
        meetingGate,
        uiLab: {
          mobile: uiLabMobile,
          drawer: uiLabDrawer,
          tablet: uiLabTablet,
          desktop: uiLabDesktop,
        },
      },
    }, null, 2));
  } finally {
    cdp?.close();
    await stop(chrome, browserListenerPid);
    await stop(dev, devListenerPid);
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
