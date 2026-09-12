import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { promisify } from "node:util";
import test from "node:test";

import { produceBoundedPatch, validateProducerSpec } from "../scripts/dev-guardian/patch-producer.mjs";
import { applyGuardedPatch } from "../scripts/dev-guardian/patch-developer-bridge.mjs";

const execFileAsync = promisify(execFile);

async function git(root, args) {
  const result = await execFileAsync("git", args, { cwd: root });
  return result.stdout.trim();
}

async function makeRepo() {
  const root = await mkdtemp(path.join(os.tmpdir(), "navixa-producer-repo-"));
  await mkdir(path.join(root, "app", "auth"), { recursive: true });
  await writeFile(path.join(root, "app", "auth", "service.ts"), "export const value = 1;\nexport const ready = true;\n", "utf8");
  await git(root, ["init"]);
  await git(root, ["config", "user.email", "dev-guardian@example.invalid"]);
  await git(root, ["config", "user.name", "NAVIXA Dev Guardian"]);
  await git(root, ["add", "."]);
  await git(root, ["commit", "-m", "fixture"]);
  return { root, head: await git(root, ["rev-parse", "HEAD"]) };
}

function planFixture(baseCommit) {
  return {
    contract: {
      validation: { valid: true, errors: [] },
      baseCommit,
      allowedScope: ["app/auth/**", "tests/auth/**"],
      forbiddenScope: ["app/auth/private/**"],
      contextPaths: ["app/auth/service.ts"],
    },
    route: { primary: "Codex" },
    guardPolicy: { maxSteps: 12, maxTokens: 10000, maxWallMs: 60_000 },
    review: { assignments: [] },
  };
}

async function patchDir() {
  return mkdtemp(path.join(os.tmpdir(), "navixa-producer-patch-"));
}

test("low-risk trial 1: producer changes one existing in-scope file and bridge applies it", async () => {
  const { root, head } = await makeRepo();
  const external = await patchDir();
  try {
    const plan = planFixture(head);
    const produced = await produceBoundedPatch({
      plan,
      producer: "Codex",
      root,
      spec: { edits: [{ type: "replace_once", path: "app/auth/service.ts", find: "value = 1", replace: "value = 2" }] },
    });
    const patchPath = path.join(external, "change.diff");
    await writeFile(patchPath, produced.patch, "utf8");
    const applied = await applyGuardedPatch({ plan, patchPath, executor: "Codex", eventLog: path.join(external, "events.jsonl"), root });
    assert.equal(applied.applied, true);
    assert.deepEqual(applied.files, ["app/auth/service.ts"]);
    assert.match(await readFile(path.join(root, "app", "auth", "service.ts"), "utf8"), /value = 2/);
  } finally {
    await rm(root, { recursive: true, force: true });
    await rm(external, { recursive: true, force: true });
  }
});

test("low-risk trial 2: producer creates one text file and bridge detects the untracked file", async () => {
  const { root, head } = await makeRepo();
  const external = await patchDir();
  try {
    const plan = planFixture(head);
    const produced = await produceBoundedPatch({
      plan,
      producer: "Codex",
      root,
      spec: { edits: [{ type: "create_text", path: "tests/auth/generated.test.ts", content: "export const generated = true;\n" }] },
    });
    const patchPath = path.join(external, "create.diff");
    await writeFile(patchPath, produced.patch, "utf8");
    const applied = await applyGuardedPatch({ plan, patchPath, executor: "Codex", eventLog: path.join(external, "events.jsonl"), root });
    assert.deepEqual(applied.files, ["tests/auth/generated.test.ts"]);
    assert.equal(await readFile(path.join(root, "tests", "auth", "generated.test.ts"), "utf8"), "export const generated = true;\n");
  } finally {
    await rm(root, { recursive: true, force: true });
    await rm(external, { recursive: true, force: true });
  }
});

test("low-risk trial 3: producer blocks an out-of-scope edit before generating a patch", async () => {
  const { root, head } = await makeRepo();
  try {
    const plan = planFixture(head);
    await assert.rejects(
      produceBoundedPatch({
        plan,
        producer: "Codex",
        root,
        spec: { edits: [{ type: "create_text", path: "app/billing/charge.ts", content: "export const charge = true;\n" }] },
      }),
      /outside-allowed-scope/,
    );
    assert.equal(await git(root, ["status", "--porcelain=v1", "--untracked-files=all"]), "");
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("producer rejects ambiguous replace, unsafe producer identity, and forbidden paths", async () => {
  const { root, head } = await makeRepo();
  try {
    const plan = planFixture(head);
    await writeFile(path.join(root, "app", "auth", "service.ts"), "same\nsame\n", "utf8");
    await assert.rejects(
      produceBoundedPatch({
        plan,
        producer: "Codex",
        root,
        spec: { edits: [{ type: "replace_once", path: "app/auth/service.ts", find: "same", replace: "changed" }] },
      }),
      /ambiguous/,
    );

    const wrongProducer = validateProducerSpec({
      plan,
      producer: "Claude Code",
      spec: { edits: [{ type: "create_text", path: "tests/auth/a.test.ts", content: "x" }] },
    });
    assert.equal(wrongProducer.allowed, false);
    assert.ok(wrongProducer.reasons.some((reason) => reason.startsWith("producer-mismatch:")));

    const forbidden = validateProducerSpec({
      plan: { ...plan, contract: { ...plan.contract, allowedScope: ["**"] } },
      producer: "Codex",
      spec: { edits: [{ type: "create_text", path: ".env.local", content: "secret" }] },
    });
    assert.equal(forbidden.allowed, false);
    assert.ok(forbidden.reasons.some((reason) => reason.includes("forbidden-scope")));
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
