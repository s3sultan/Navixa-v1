import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

const STAGING_URL = process.env.STAGING_URL || "https://navixa-staging.s2shug.workers.dev";
const EXPECTED_STAGING_URL = "https://navixa-staging.s2shug.workers.dev";
const DEBUG_PORT = Number(process.env.NAVIXA_CDP_PORT || 9335);
const DEBUG_URL = `http://127.0.0.1:${DEBUG_PORT}`;
const sleep = milliseconds => new Promise(resolve => setTimeout(resolve, milliseconds));

if (STAGING_URL !== EXPECTED_STAGING_URL) {
  throw new Error("CSP smoke is restricted to the official NAVIXA staging Worker");
}

function start(command, args) {
  return spawn(command, args, {
    detached: true,
    stdio: ["ignore", "pipe", "pipe"],
    env: process.env,
  });
}

async function stop(processHandle) {
  if (!processHandle?.pid || processHandle.exitCode !== null) return;
  try { process.kill(-processHandle.pid, "SIGTERM"); } catch { return; }
  await Promise.race([
    new Promise(resolve => processHandle.once("exit", resolve)),
    sleep(1_500),
  ]);
}

async function waitForDebugger(attempts = 120) {
  let lastError;
  for (let attempt = 0; attempt < attempts; attempt += 1) {
    try {
      const response = await fetch(`${DEBUG_URL}/json/list`, { cache: "no-store" });
      if (response.ok) return await response.json();
    } catch (error) { lastError = error; }
    await sleep(250);
  }
  throw new Error(`Chrome DevTools did not start: ${lastError instanceof Error ? lastError.message : "timeout"}`);
}

async function connectCdp() {
  const pages = await waitForDebugger();
  const page = pages.find(item => item.type === "page");
  assert.ok(page?.webSocketDebuggerUrl, "No Chrome page target was found");

  const socket = new WebSocket(page.webSocketDebuggerUrl);
  const pending = new Map();
  const eventHandlers = new Set();
  let sequence = 0;

  await new Promise((resolve, reject) => {
    socket.addEventListener("open", resolve, { once: true });
    socket.addEventListener("error", reject, { once: true });
  });

  socket.addEventListener("message", event => {
    const message = JSON.parse(event.data);
    if (message.id) {
      const request = pending.get(message.id);
      if (!request) return;
      pending.delete(message.id);
      if (message.error) request.reject(new Error(message.error.message));
      else request.resolve(message.result);
      return;
    }
    for (const handler of eventHandlers) handler(message);
  });

  const call = (method, params = {}) => new Promise((resolve, reject) => {
    const id = ++sequence;
    pending.set(id, { resolve, reject });
    socket.send(JSON.stringify({ id, method, params }));
  });

  return {
    call,
    onEvent(handler) { eventHandlers.add(handler); return () => eventHandlers.delete(handler); },
    close() { socket.close(); },
  };
}

async function evaluate(cdp, expression) {
  const result = await cdp.call("Runtime.evaluate", {
    expression,
    awaitPromise: true,
    returnByValue: true,
  });
  if (result.exceptionDetails) throw new Error(result.exceptionDetails.text || "Runtime evaluation failed");
  return result.result?.value;
}

async function waitForDocument(cdp, expectedPath, attempts = 80) {
  let lastState;
  for (let attempt = 0; attempt < attempts; attempt += 1) {
    try {
      lastState = await evaluate(cdp, `(() => ({
        readyState: document.readyState,
        path: location.pathname,
        htmlLength: document.documentElement?.outerHTML?.length || 0,
        bodyLength: document.body?.innerText?.length || 0,
        title: document.title || ""
      }))()`);
      if (lastState?.path === expectedPath && ["interactive", "complete"].includes(lastState.readyState) && lastState.htmlLength > 500) {
        return lastState;
      }
    } catch {
      // The execution context can disappear briefly during navigation.
    }
    await sleep(250);
  }
  throw new Error(`Chrome did not render ${expectedPath}; last state=${JSON.stringify(lastState)}`);
}

function isScriptOrStyleCspViolation(entry) {
  const source = String(entry?.source || "").toLowerCase();
  const text = String(entry?.text || "");
  if (source !== "security" && !/content security policy/i.test(text)) return false;
  return /(script-src|style-src)/i.test(text) && /(violat|refused|blocked)/i.test(text);
}

async function main() {
  const profileDir = await mkdtemp(join(tmpdir(), "navixa-staging-csp-"));
  const chrome = start(process.env.CHROME_BIN || "google-chrome", [
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

  const chromeErrors = [];
  chrome.stderr.on("data", chunk => chromeErrors.push(chunk.toString()));
  let cdp;

  try {
    cdp = await connectCdp();
    const logEntries = [];
    cdp.onEvent(message => {
      if (message.method === "Log.entryAdded" && message.params?.entry) logEntries.push(message.params.entry);
    });

    await Promise.all([
      cdp.call("Page.enable"),
      cdp.call("Runtime.enable"),
      cdp.call("Log.enable"),
      cdp.call("Network.enable"),
    ]);

    const routes = ["/", "/today", "/account", "/admin/login", "/meetings"];
    const rendered = [];
    for (const path of routes) {
      const before = logEntries.length;
      const url = new URL(path, STAGING_URL);
      url.searchParams.set("csp_probe", `${Date.now()}-${Math.random().toString(16).slice(2)}`);
      await cdp.call("Page.navigate", { url: url.toString() });
      const state = await waitForDocument(cdp, path);
      await sleep(2_000);
      const routeEntries = logEntries.slice(before);
      const violations = routeEntries.filter(isScriptOrStyleCspViolation);
      rendered.push({ path, ...state, cspViolations: violations.length });
      if (violations.length) {
        console.error(`CSP script/style violations on ${path}:`);
        for (const entry of violations.slice(0, 30)) console.error(`[${entry.source}] ${entry.text}`);
        throw new Error(`Strict CSP report-only is not yet compatible with ${path}`);
      }
    }

    console.log(JSON.stringify({ status: "passed", staging: STAGING_URL, rendered }, null, 2));
  } catch (error) {
    const chromeTail = chromeErrors.join("").trim().split("\n").slice(-40).join("\n");
    if (chromeTail) console.error(`Chrome stderr tail:\n${chromeTail}`);
    throw error;
  } finally {
    cdp?.close();
    await stop(chrome);
    await rm(profileDir, { recursive: true, force: true }).catch(() => undefined);
  }
}

main().then(
  () => process.exit(0),
  error => {
    console.error(error instanceof Error ? error.stack : error);
    process.exit(1);
  },
);
