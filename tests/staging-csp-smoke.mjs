import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

const STAGING_URL = process.env.STAGING_URL || "https://navixa-staging.s2shug.workers.dev";
const EXPECTED_STAGING_URL = "https://navixa-staging.s2shug.workers.dev";
const DEBUG_PORT = Number(process.env.NAVIXA_CDP_PORT || 9335);
const DEBUG_URL = `http://127.0.0.1:${DEBUG_PORT}`;
const PROBE_PARAM = "csp_nonce_probe";
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
      lastState = await evaluate(cdp, `(() => {
        const executableInlineScripts = [...document.scripts].filter(script => {
          if (script.src) return false;
          const type = String(script.type || "").trim().toLowerCase();
          return type === "" || type === "module" || type === "text/javascript" || type === "application/javascript" || type === "text/ecmascript" || type === "application/ecmascript";
        });
        const inlineStyles = [...document.querySelectorAll("style")];
        return {
          readyState: document.readyState,
          path: location.pathname,
          htmlLength: document.documentElement?.outerHTML?.length || 0,
          bodyLength: document.body?.innerText?.length || 0,
          title: document.title || "",
          executableInlineScripts: executableInlineScripts.length,
          noncedExecutableInlineScripts: executableInlineScripts.filter(script => Boolean(script.nonce)).length,
          inlineStyles: inlineStyles.length,
          noncedInlineStyles: inlineStyles.filter(style => Boolean(style.nonce)).length
        };
      })()`);
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

function directive(policy, name) {
  return policy.split(";").map(value => value.trim()).find(value => value === name || value.startsWith(`${name} `)) || "";
}

async function assertNonceProbeHeaders(url) {
  const response = await fetch(url, { redirect: "manual", headers: { "cache-control": "no-cache" } });
  assert.ok(response.status >= 200 && response.status < 500, `Unexpected probe status ${response.status} for ${url.pathname}`);
  assert.equal(response.headers.get("x-navixa-csp-probe"), "nonce-style-elem-v2", `Nonce/style middleware did not run for ${url.pathname}`);
  const policy = response.headers.get("content-security-policy-report-only") || "";
  const scripts = directive(policy, "script-src");
  const styleElements = directive(policy, "style-src-elem");
  const styleAttributes = directive(policy, "style-src-attr");
  assert.match(scripts, /'nonce-[a-f0-9]{32}'/i, `Nonce is missing from script-src for ${url.pathname}`);
  assert.doesNotMatch(scripts, /'unsafe-inline'/i, `script-src still allows unsafe-inline for ${url.pathname}`);

  if (url.pathname === "/admin/login") {
    assert.equal(response.headers.get("x-navixa-csp-style-exception"), "google-identity", "Google Identity style exception was not explicitly marked");
    assert.match(styleElements, /'unsafe-inline'/i, "Google Identity inline styles are not isolated to the documented login exception");
    assert.match(styleElements, /https:\/\/accounts\.google\.com/i, "Google Identity stylesheet origin is missing from the login exception");
  } else {
    assert.equal(response.headers.get("x-navixa-csp-style-exception"), null, `Unexpected style exception on ${url.pathname}`);
    assert.match(styleElements, /'nonce-[a-f0-9]{32}'/i, `Nonce is missing from style-src-elem for ${url.pathname}`);
    assert.doesNotMatch(styleElements, /'unsafe-inline'/i, `style-src-elem still allows unsafe-inline for ${url.pathname}`);
  }

  assert.match(styleAttributes, /'unsafe-inline'/i, `style-src-attr was tightened before its compatibility inventory for ${url.pathname}`);
}

function isExecutableCspViolation(entry) {
  const source = String(entry?.source || "").toLowerCase();
  const text = String(entry?.text || "");
  if (source !== "security" && !/content security policy/i.test(text)) return false;
  if (!/(violat|refused|blocked)/i.test(text)) return false;
  if (/script-src/i.test(text)) return true;
  return /style-src/i.test(text) && !/style-src-attr/i.test(text);
}

function violationHashes(entries) {
  const hashes = new Set();
  for (const entry of entries) {
    const text = String(entry?.text || "");
    for (const match of text.matchAll(/sha256-([^'"\s)]+)/g)) hashes.add(match[1]);
  }
  return hashes;
}

function sha256Base64(value) {
  return createHash("sha256").update(value, "utf8").digest("base64");
}

async function inlineDiagnostics(cdp, violations) {
  const payload = await evaluate(cdp, `(() => ({
    scripts: [...document.scripts]
      .map((script, index) => ({ index, src: script.src || "", type: script.type || "", nonce: script.nonce || "", text: script.src ? "" : (script.textContent || "") }))
      .filter(script => !script.src),
    styles: [...document.querySelectorAll("style")]
      .map((style, index) => ({ index, nonce: style.nonce || "", text: style.textContent || "" }))
  }))()`);
  const offendingHashes = violationHashes(violations);
  const summarize = (item, kind) => {
    const hash = sha256Base64(item.text || "");
    return {
      kind,
      index: item.index,
      type: item.type || "",
      hasNonce: Boolean(item.nonce),
      noncePrefix: item.nonce ? `${String(item.nonce).slice(0, 8)}…` : "",
      bytes: Buffer.byteLength(item.text || "", "utf8"),
      sha256: hash,
      matchesViolation: offendingHashes.has(hash),
      prefix: String(item.text || "").replace(/\s+/g, " ").trim().slice(0, 180),
    };
  };
  return [
    ...(Array.isArray(payload?.scripts) ? payload.scripts.map(item => summarize(item, "script")) : []),
    ...(Array.isArray(payload?.styles) ? payload.styles.map(item => summarize(item, "style")) : []),
  ];
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
      url.searchParams.set(PROBE_PARAM, `${Date.now()}-${Math.random().toString(16).slice(2)}`);
      await assertNonceProbeHeaders(url);
      await cdp.call("Page.navigate", { url: url.toString() });
      const state = await waitForDocument(cdp, path);
      await sleep(2_000);
      const routeEntries = logEntries.slice(before);
      const violations = routeEntries.filter(isExecutableCspViolation);
      const diagnostics = await inlineDiagnostics(cdp, violations);
      rendered.push({ path, ...state, executableCspViolations: violations.length });
      if (violations.length) {
        console.error(`CSP script/style-element violations on ${path}:`);
        for (const entry of violations.slice(0, 30)) console.error(`[${entry.source}] ${entry.text}`);
        console.error("Inline CSP diagnosis:");
        for (const item of diagnostics.filter(entry => entry.matchesViolation || !entry.hasNonce).slice(0, 40)) {
          console.error(JSON.stringify(item));
        }
        throw new Error(`Nonce-based script/style-element CSP is not yet compatible with ${path}`);
      }
      assert.equal(
        state.noncedExecutableInlineScripts,
        state.executableInlineScripts,
        `Not every executable inline script carried a nonce on ${path}`,
      );
      if (path !== "/admin/login") {
        assert.equal(
          state.noncedInlineStyles,
          state.inlineStyles,
          `Not every inline style element carried a nonce on ${path}`,
        );
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
