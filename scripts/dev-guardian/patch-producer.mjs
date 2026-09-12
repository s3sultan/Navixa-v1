#!/usr/bin/env node

import { constants } from "node:fs";
import { lstat, mkdtemp, open, readFile, rm, writeFile } from "node:fs/promises";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import os from "node:os";
import path from "node:path";
import { createHash } from "node:crypto";
import { DEV_GUARDIAN_DEFAULTS, evaluateScope } from "./guards.mjs";
import { validateExecutorMutation } from "./executor-guard.mjs";
import { parsePatchManifest } from "./patch-developer-bridge.mjs";

const execFileAsync = promisify(execFile);
const MAX_EDITS = 8;
const MAX_OUTPUT_BYTES = 180_000;
const MAX_NEW_FILE_BYTES = 48_000;
const MAX_EXISTING_FILE_BYTES = 96_000;
const READ_NOFOLLOW = constants.O_RDONLY | (constants.O_NOFOLLOW || 0);

function fingerprint(value) {
  return createHash("sha256").update(String(value || "")).digest("hex").slice(0, 24);
}

function normalizeRepoPath(value) {
  return path.posix.normalize(String(value || "").trim().replaceAll("\\", "/")).replace(/^\.\//, "");
}

function withinRoot(root, candidate) {
  const relative = path.relative(root, candidate);
  return relative && !relative.startsWith("..") && !path.isAbsolute(relative);
}

async function runGitDiff(oldPath, newPath) {
  try {
    await execFileAsync("git", ["diff", "--no-index", "--no-color", "--text", "--", oldPath, newPath], {
      maxBuffer: 2 * 1024 * 1024,
      env: { ...process.env, GIT_CONFIG_NOSYSTEM: "1" },
    });
    return "";
  } catch (error) {
    if (error?.code !== 1 || typeof error.stdout !== "string") throw error;
    return error.stdout;
  }
}

function rewriteDiffPaths(diffText, filePath, { create = false } = {}) {
  const normalized = normalizeRepoPath(filePath);
  const lines = String(diffText).split(/\r?\n/);
  const output = [];
  let sawDiff = false;
  let sawOld = false;
  let sawNew = false;

  for (const line of lines) {
    if (line.startsWith("diff --git ")) {
      output.push(`diff --git a/${normalized} b/${normalized}`);
      if (create) output.push("new file mode 100644");
      sawDiff = true;
      continue;
    }
    if (line.startsWith("--- ")) {
      output.push(create ? "--- /dev/null" : `--- a/${normalized}`);
      sawOld = true;
      continue;
    }
    if (line.startsWith("+++ ")) {
      output.push(`+++ b/${normalized}`);
      sawNew = true;
      continue;
    }
    if (create && line.startsWith("index ")) {
      const parts = line.split(" ");
      const hashes = parts[1]?.split("..") || [];
      output.push(hashes.length === 2 ? `index 0000000..${hashes[1]} ${parts[2] || "100644"}` : line);
      continue;
    }
    output.push(line);
  }

  if (!sawDiff || !sawOld || !sawNew) throw new Error(`Could not build a valid unified diff for ${normalized}.`);
  return output.join("\n").replace(/\n+$/, "\n");
}

async function assertRegularTextFile(root, relativePath) {
  const absolute = path.resolve(root, relativePath);
  if (!withinRoot(root, absolute)) throw new Error(`Unsafe repository path: ${relativePath}`);
  let handle;
  try {
    handle = await open(absolute, READ_NOFOLLOW);
    const metadata = await handle.stat();
    if (!metadata.isFile()) throw new Error(`Only regular text files are supported: ${relativePath}`);
    if (metadata.size > MAX_EXISTING_FILE_BYTES) throw new Error(`Existing file exceeds ${MAX_EXISTING_FILE_BYTES} bytes: ${relativePath}`);
    const content = await handle.readFile({ encoding: "utf8" });
    if (content.includes("\u0000")) throw new Error(`Binary-like file is not supported: ${relativePath}`);
    return content;
  } finally {
    await handle?.close().catch(() => undefined);
  }
}

function validateEditShape(edit, index) {
  if (!edit || typeof edit !== "object" || Array.isArray(edit)) throw new Error(`Edit ${index + 1} must be an object.`);
  const type = String(edit.type || "");
  if (!new Set(["replace_once", "create_text"]).has(type)) throw new Error(`Unsupported edit type at ${index + 1}: ${type || "missing"}`);
  const filePath = normalizeRepoPath(edit.path);
  if (!filePath || filePath === "." || filePath === ".." || filePath.startsWith("../") || path.posix.isAbsolute(filePath)) {
    throw new Error(`Unsafe edit path at ${index + 1}: ${edit.path || "missing"}`);
  }
  return { ...edit, type, path: filePath };
}

export function validateProducerSpec({ plan, producer, spec } = {}) {
  const reasons = [];
  if (!plan?.contract?.validation?.valid) reasons.push("invalid-task-contract");
  if (!producer || producer !== plan?.route?.primary) reasons.push(`producer-mismatch:${producer || "missing"}:${plan?.route?.primary || "missing"}`);
  if (!spec || typeof spec !== "object" || Array.isArray(spec)) reasons.push("invalid-edit-spec");
  const edits = Array.isArray(spec?.edits) ? spec.edits : [];
  if (edits.length < 1) reasons.push("edit-spec-empty");
  if (edits.length > MAX_EDITS) reasons.push(`too-many-edits:${edits.length}:${MAX_EDITS}`);
  const normalized = [];
  for (let index = 0; index < edits.length; index += 1) {
    try {
      normalized.push(validateEditShape(edits[index], index));
    } catch (error) {
      reasons.push(`edit-invalid:${error.message}`);
    }
  }

  const paths = normalized.map((edit) => edit.path);
  const scope = evaluateScope({
    files: paths,
    allowed: plan?.contract?.allowedScope || [],
    forbidden: [...DEV_GUARDIAN_DEFAULTS.forbiddenPaths, ...(plan?.contract?.forbiddenScope || [])],
  });
  for (const item of scope.blocked) reasons.push(`scope:${item.reason}:${item.file}`);

  const mutation = validateExecutorMutation({
    plan,
    executor: producer,
    baseCommit: plan?.contract?.baseCommit,
    changedFiles: paths,
    events: [],
    usage: { steps: 0, tokens: 0, costUsd: 0, startedAt: Date.now(), now: Date.now() },
  });
  for (const reason of mutation.reasons || []) reasons.push(`executor:${reason}`);

  return {
    allowed: reasons.length === 0,
    reasons: [...new Set(reasons)],
    edits: normalized,
    scope,
  };
}

export async function produceBoundedPatch({ plan, producer, spec, root = process.cwd() } = {}) {
  const repositoryRoot = path.resolve(root);
  const validation = validateProducerSpec({ plan, producer, spec });
  if (!validation.allowed) throw new Error(`Patch Producer blocked spec: ${validation.reasons.join(", ")}`);

  const tempRoot = await mkdtemp(path.join(os.tmpdir(), "navixa-patch-producer-"));
  try {
    const patches = [];
    for (let index = 0; index < validation.edits.length; index += 1) {
      const edit = validation.edits[index];
      const oldTemp = path.join(tempRoot, `${index}-old.txt`);
      const newTemp = path.join(tempRoot, `${index}-new.txt`);

      if (edit.type === "replace_once") {
        const current = await assertRegularTextFile(repositoryRoot, edit.path);
        const find = String(edit.find ?? "");
        const replacement = String(edit.replace ?? "");
        if (!find) throw new Error(`replace_once requires non-empty find text: ${edit.path}`);
        const first = current.indexOf(find);
        const second = first < 0 ? -1 : current.indexOf(find, first + find.length);
        if (first < 0) throw new Error(`replace_once target not found: ${edit.path}`);
        if (second >= 0) throw new Error(`replace_once target is ambiguous: ${edit.path}`);
        const next = `${current.slice(0, first)}${replacement}${current.slice(first + find.length)}`;
        await writeFile(oldTemp, current, "utf8");
        await writeFile(newTemp, next, "utf8");
        const diff = await runGitDiff(oldTemp, newTemp);
        if (!diff) throw new Error(`replace_once produced no change: ${edit.path}`);
        patches.push(rewriteDiffPaths(diff, edit.path));
      } else if (edit.type === "create_text") {
        const absolute = path.resolve(repositoryRoot, edit.path);
        if (!withinRoot(repositoryRoot, absolute)) throw new Error(`Unsafe create path: ${edit.path}`);
        try {
          await lstat(absolute);
          throw new Error(`create_text target already exists: ${edit.path}`);
        } catch (error) {
          if (error?.code !== "ENOENT") throw error;
        }
        const content = String(edit.content ?? "");
        if (!content) throw new Error(`create_text requires non-empty content: ${edit.path}`);
        if (content.includes("\u0000")) throw new Error(`create_text rejects binary-like content: ${edit.path}`);
        if (Buffer.byteLength(content) > MAX_NEW_FILE_BYTES) throw new Error(`New file exceeds ${MAX_NEW_FILE_BYTES} bytes: ${edit.path}`);
        await writeFile(oldTemp, "", "utf8");
        await writeFile(newTemp, content, "utf8");
        const diff = await runGitDiff(oldTemp, newTemp);
        if (!diff) throw new Error(`create_text produced no change: ${edit.path}`);
        patches.push(rewriteDiffPaths(diff, edit.path, { create: true }));
      }
    }

    const patch = patches.join("\n").replace(/\n+$/, "\n");
    if (Buffer.byteLength(patch) > MAX_OUTPUT_BYTES) throw new Error(`Produced patch exceeds ${MAX_OUTPUT_BYTES} bytes.`);
    const manifest = parsePatchManifest(patch);
    if (manifest.violations.length) throw new Error(`Produced patch failed manifest validation: ${manifest.violations.join(", ")}`);
    const expected = [...new Set(validation.edits.map((edit) => edit.path))].sort();
    const actual = [...manifest.files].sort();
    if (JSON.stringify(actual) !== JSON.stringify(expected)) {
      throw new Error(`Produced patch manifest mismatch: expected ${expected.join(", ")}; got ${actual.join(", ")}`);
    }

    return {
      schemaVersion: 1,
      producer,
      baseCommit: plan.contract.baseCommit,
      patch,
      patchFingerprint: fingerprint(patch),
      files: manifest.files,
      editCount: validation.edits.length,
    };
  } finally {
    await rm(tempRoot, { recursive: true, force: true });
  }
}

async function main() {
  const planPath = process.env.NAVIXA_PLAN_FILE;
  const specPath = process.env.NAVIXA_EDIT_SPEC_FILE;
  const outputPath = process.env.NAVIXA_PATCH_OUTPUT;
  const producer = process.env.NAVIXA_PRODUCER;
  if (!planPath || !specPath || !outputPath || !producer) {
    throw new Error("NAVIXA_PLAN_FILE, NAVIXA_EDIT_SPEC_FILE, NAVIXA_PATCH_OUTPUT and NAVIXA_PRODUCER are required.");
  }
  const repositoryRoot = process.cwd();
  const absoluteOutput = path.resolve(outputPath);
  const relativeOutput = path.relative(repositoryRoot, absoluteOutput);
  if (!relativeOutput.startsWith("..") && !path.isAbsolute(relativeOutput)) {
    throw new Error("Patch output must live outside the repository working tree.");
  }
  const plan = JSON.parse(await readFile(planPath, "utf8"));
  const spec = JSON.parse(await readFile(specPath, "utf8"));
  const result = await produceBoundedPatch({ plan, producer, spec, root: repositoryRoot });
  await writeFile(absoluteOutput, result.patch, "utf8");
  process.stdout.write(`${JSON.stringify({ ...result, patch: undefined }, null, 2)}\n`);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((error) => {
    console.error(`NAVIXA patch producer failed: ${error.message}`);
    process.exitCode = 1;
  });
}
