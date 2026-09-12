import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

const APP_PORT = 4175;
const DEBUG_PORT = 9334;
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

function start(command, args, env = {}) {
  return spawn(command, args, {
    detached: true,
    windowsHide: true,
    stdio: ["ignore", "pipe", "pipe"],
    env: { ...process.env, ...env },
  });
}

async function waitForUrl(url, label, attempts = 180) {
  let lastError;
  for (let attempt = 0; attempt < attempts; attempt += 1) {
    try {
      const response = await fetch(url, { redirect: "manual" });
      if (response.status > 0) return response;
    } catch (error) {
      lastError = error;
    }
    await sleep(350);
  }
  throw new Error(`${label} لم يبدأ: ${lastError instanceof Error ? lastError.message : "انتهت المهلة"}`);
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
    processHandle.once("exit", () => {
      clearTimeout(timer);
      resolve();
    });
    try {
      process.kill(-processHandle.pid, "SIGTERM");
    } catch {
      resolve();
    }
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
  const result = await cdp.call("Runtime.evaluate", {
    expression,
    awaitPromise: true,
    returnByValue: true,
  });
  return result.result.value;
}

async function navigate(cdp, url) {
  await cdp.call("Page.navigate", { url });
  await sleep(250);
  const ready = await evaluate(cdp, `new Promise(resolve => {
    const deadline = performance.now() + 15_000;
    const inspect = () => {
      const heading = document.querySelector('main h1');
      if (document.readyState !== 'loading' && heading) return resolve(true);
      if (performance.now() >= deadline) return resolve(false);
      setTimeout(inspect, 100);
    };
    inspect();
  })`);
  assert.equal(ready, true, `لم تجهز صفحة ${url}`);
}

async function inspectViewport(cdp, { width, height, mobile }) {
  await cdp.call("Emulation.setDeviceMetricsOverride", {
    width,
    height,
    deviceScaleFactor: 1,
    mobile,
  });
  await navigate(cdp, `${BASE_URL}/ui-lab`);

  return evaluate(cdp, `(() => {
    const sidebar = document.querySelector('aside[aria-label="التنقل الرئيسي"]');
    const bottomNav = document.querySelector('nav[aria-label="التنقل السريع"]');
    const menuButton = document.querySelector('button[aria-controls="navixa-mobile-navigation"]');
    const sidebarRect = sidebar?.getBoundingClientRect();
    return {
      viewport: innerWidth,
      scrollWidth: document.documentElement.scrollWidth,
      overflow: document.documentElement.scrollWidth > innerWidth + 1,
      sidebarDisplay: sidebar ? getComputedStyle(sidebar).display : null,
      sidebarWidth: sidebarRect ? Math.round(sidebarRect.width) : 0,
      bottomNavDisplay: bottomNav ? getComputedStyle(bottomNav).display : null,
      menuDisplay: menuButton ? getComputedStyle(menuButton).display : null,
      cards: document.querySelectorAll('main section').length,
    };
  })()`);
}

async function main() {
  const profileDir = await mkdtemp(join(tmpdir(), "navixa-ui-system-profile-"));
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
    await waitForUrl(`${BASE_URL}/ui-lab`, "خادم NAVIXA UI Lab").catch(error => {
      throw new Error(`${error instanceof Error ? error.message : error}\n${logs.join("").slice(-4000)}`);
    });
    devListenerPid = await windowsListenerPid(APP_PORT);

    chrome = start(browserCommand(), [
      "--headless=new",
      "--no-sandbox",
      "--disable-gpu",
      "--disable-dev-shm-usage",
      "--no-first-run",
      "--no-default-browser-check",
      "--remote-allow-origins=*",
      `--remote-debugging-port=${DEBUG_PORT}`,
      "--remote-debugging-address=127.0.0.1",
      `--user-data-dir=${profileDir}`,
      "about:blank",
    ]);

    await waitForUrl(`${DEBUG_URL}/json/list`, "متصفح UI System", 100);
    browserListenerPid = await windowsListenerPid(DEBUG_PORT);
    cdp = await connectCdp();

    const mobile = await inspectViewport(cdp, { width: 390, height: 844, mobile: true });
    assert.equal(mobile.overflow, false, `يوجد overflow أفقي على الجوال: ${JSON.stringify(mobile)}`);
    assert.equal(mobile.sidebarDisplay, "none", "يجب إخفاء Sidebar على الجوال");
    assert.notEqual(mobile.bottomNavDisplay, "none", "يجب إظهار Bottom Navigation على الجوال");
    assert.notEqual(mobile.menuDisplay, "none", "يجب إظهار زر قائمة الجوال");
    assert.ok(mobile.cards >= 5, "يجب أن تظهر بطاقات المعاينة الأساسية على الجوال");

    await evaluate(cdp, `document.querySelector('button[aria-controls="navixa-mobile-navigation"]')?.click()`);
    await sleep(260);
    const drawer = await evaluate(cdp, `(() => {
      const element = document.getElementById('navixa-mobile-navigation');
      const rect = element?.getBoundingClientRect();
      return {
        found: Boolean(element),
        role: element?.getAttribute('role') || null,
        modal: element?.getAttribute('aria-modal') || null,
        width: rect ? Math.round(rect.width) : 0,
        bottomGap: rect ? Math.round(innerHeight - rect.bottom) : null,
      };
    })()`);
    assert.equal(drawer.found, true, "يجب أن يفتح Drawer الجوال");
    assert.equal(drawer.role, "dialog", "يجب أن يحمل Drawer دلالة dialog");
    assert.equal(drawer.modal, "true", "يجب أن يعلن Drawer أنه modal");
    assert.ok(drawer.width >= 380, `عرض Drawer غير متوقع: ${JSON.stringify(drawer)}`);
    assert.ok(Math.abs(drawer.bottomGap ?? 99) <= 1, `يجب أن يستقر Drawer عند أسفل الشاشة: ${JSON.stringify(drawer)}`);

    await cdp.call("Input.dispatchKeyEvent", { type: "keyDown", key: "Escape", code: "Escape" });
    await cdp.call("Input.dispatchKeyEvent", { type: "keyUp", key: "Escape", code: "Escape" });
    await sleep(100);
    assert.equal(await evaluate(cdp, `!document.getElementById('navixa-mobile-navigation')`), true, "يجب أن يغلق Drawer بزر Escape");

    const tablet = await inspectViewport(cdp, { width: 820, height: 900, mobile: false });
    assert.equal(tablet.overflow, false, `يوجد overflow أفقي على التابلت: ${JSON.stringify(tablet)}`);
    assert.notEqual(tablet.sidebarDisplay, "none", "يجب إظهار الشريط الجانبي المختصر على التابلت");
    assert.ok(tablet.sidebarWidth >= 70 && tablet.sidebarWidth <= 110, `عرض شريط التابلت غير متوقع: ${JSON.stringify(tablet)}`);
    assert.equal(tablet.bottomNavDisplay, "none", "يجب إخفاء Bottom Navigation على التابلت");
    assert.equal(tablet.menuDisplay, "none", "يجب إخفاء زر قائمة الجوال على التابلت");

    const desktop = await inspectViewport(cdp, { width: 1440, height: 1000, mobile: false });
    assert.equal(desktop.overflow, false, `يوجد overflow أفقي على سطح المكتب: ${JSON.stringify(desktop)}`);
    assert.notEqual(desktop.sidebarDisplay, "none", "يجب إظهار Sidebar كامل على سطح المكتب");
    assert.ok(desktop.sidebarWidth >= 240, `عرض Sidebar سطح المكتب غير متوقع: ${JSON.stringify(desktop)}`);
    assert.equal(desktop.bottomNavDisplay, "none", "يجب إخفاء Bottom Navigation على سطح المكتب");
    assert.equal(desktop.menuDisplay, "none", "يجب إخفاء زر قائمة الجوال على سطح المكتب");

    console.log(JSON.stringify({ status: "passed", mobile, drawer, tablet, desktop }, null, 2));
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
