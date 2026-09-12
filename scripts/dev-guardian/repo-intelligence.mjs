#!/usr/bin/env node

import { readdir, readFile, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const SOURCE_EXTENSIONS = [".ts", ".tsx", ".js", ".jsx", ".mjs", ".cjs", ".json"];
const TEXT_EXTENSIONS = new Set([
  ...SOURCE_EXTENSIONS,
  ".md",
  ".css",
  ".scss",
  ".html",
  ".yml",
  ".yaml",
  ".sql",
  ".sh",
  ".py",
]);
const IGNORE_DIRECTORIES = new Set([
  ".git",
  ".next",
  ".turbo",
  ".vercel",
  ".wrangler",
  "node_modules",
  "dist",
  "build",
  "coverage",
]);

function toPosix(value) {
  return value.split(path.sep).join("/");
}

function classifyFile(relativePath) {
  if (/^app\/.+\/route\.(?:ts|tsx|js|jsx)$/.test(relativePath)) return "api-route";
  if (/^app\/(?:.+\/)?page\.(?:ts|tsx|js|jsx)$/.test(relativePath)) return "page";
  if (/^app\/(?:.+\/)?layout\.(?:ts|tsx|js|jsx)$/.test(relativePath)) return "layout";
  if (/^tests?\//.test(relativePath) || /(?:^|\/).+\.(?:test|spec)\.[^.]+$/.test(relativePath)) return "test";
  if (/^\.github\/workflows\/.+\.ya?ml$/.test(relativePath)) return "workflow";
  if (/^migrations\/.+\.sql$/.test(relativePath)) return "migration";
  if (/^scripts\//.test(relativePath)) return "script";
  if (relativePath.endsWith("package.json")) return "package-manifest";
  return "source";
}

function extractImportSpecifiers(content) {
  const patterns = [
    /\b(?:import|export)\s+(?:[^"'`]*?\s+from\s+)?["'`]([^"'`]+)["'`]/g,
    /\bimport\s*\(\s*["'`]([^"'`]+)["'`]\s*\)/g,
    /\brequire\s*\(\s*["'`]([^"'`]+)["'`]\s*\)/g,
  ];
  const imports = new Set();
  for (const pattern of patterns) {
    for (const match of content.matchAll(pattern)) imports.add(match[1]);
  }
  return [...imports];
}

function routePathFromFile(relativePath) {
  if (!/^app\//.test(relativePath)) return null;
  const withoutApp = relativePath.replace(/^app\//, "").replace(/\/(?:route|page)\.(?:ts|tsx|js|jsx)$/, "");
  const clean = withoutApp
    .split("/")
    .filter((segment) => !/^\(.+\)$/.test(segment))
    .join("/");
  return `/${clean}`.replace(/\/$/, "") || "/";
}

async function walk(root, current = root, output = []) {
  const entries = await readdir(current, { withFileTypes: true });
  entries.sort((a, b) => a.name.localeCompare(b.name));
  for (const entry of entries) {
    if (entry.name.startsWith(".") && entry.name !== ".github") {
      if (entry.isDirectory() || entry.name === ".DS_Store") continue;
    }
    if (entry.isDirectory() && IGNORE_DIRECTORIES.has(entry.name)) continue;
    const absolute = path.join(current, entry.name);
    if (entry.isDirectory()) {
      await walk(root, absolute, output);
      continue;
    }
    if (!entry.isFile()) continue;
    const relative = toPosix(path.relative(root, absolute));
    const extension = path.extname(relative).toLowerCase();
    if (!TEXT_EXTENSIONS.has(extension) && path.basename(relative) !== "package.json") continue;
    output.push({ absolute, relative, extension });
  }
  return output;
}

function buildCandidatePaths(importerRelative, specifier) {
  if (!specifier.startsWith(".")) return [];
  const importerDir = path.posix.dirname(importerRelative);
  const base = path.posix.normalize(path.posix.join(importerDir, specifier));
  const extension = path.posix.extname(base);
  const candidates = [];
  if (extension) candidates.push(base);
  else {
    for (const ext of SOURCE_EXTENSIONS) candidates.push(`${base}${ext}`);
    for (const ext of SOURCE_EXTENSIONS) candidates.push(`${base}/index${ext}`);
  }
  return candidates;
}

function resolveRelativeImport(importerRelative, specifier, fileSet) {
  for (const candidate of buildCandidatePaths(importerRelative, specifier)) {
    if (fileSet.has(candidate)) return candidate;
  }
  return null;
}

function basenameStem(relativePath) {
  return path.posix.basename(relativePath).replace(/\.(?:test|spec)?\.?[cm]?[jt]sx?$/, "").replace(/\.[^.]+$/, "");
}

function linkTests(files, dependencyGraph) {
  const tests = files.filter((file) => file.kind === "test");
  const sourceFiles = files.filter((file) => file.kind !== "test");
  const links = new Map(sourceFiles.map((file) => [file.path, new Set()]));

  for (const test of tests) {
    for (const dependency of dependencyGraph[test.path] || []) {
      if (links.has(dependency)) links.get(dependency).add(test.path);
    }
    const testStem = basenameStem(test.path);
    for (const source of sourceFiles) {
      if (basenameStem(source.path) === testStem) links.get(source.path).add(test.path);
    }
  }
  return Object.fromEntries([...links.entries()].filter(([, value]) => value.size).map(([key, value]) => [key, [...value].sort()]));
}

function calculateHotspots(files, graph, reverseGraph, testLinks) {
  return files
    .filter((file) => ["source", "api-route", "page", "layout", "script"].includes(file.kind))
    .map((file) => {
      const incoming = (reverseGraph[file.path] || []).length;
      const outgoing = (graph[file.path] || []).length;
      const tests = (testLinks[file.path] || []).length;
      const routeWeight = ["api-route", "page"].includes(file.kind) ? 3 : 0;
      return {
        path: file.path,
        kind: file.kind,
        score: incoming * 3 + outgoing + tests * 2 + routeWeight,
        incoming,
        outgoing,
        tests,
      };
    })
    .sort((a, b) => b.score - a.score || b.incoming - a.incoming || a.path.localeCompare(b.path))
    .slice(0, 40);
}

export async function buildRepositoryMap(rootInput = process.cwd()) {
  const root = path.resolve(rootInput);
  const metadata = await stat(root);
  if (!metadata.isDirectory()) throw new Error(`Repository root is not a directory: ${root}`);

  const walked = await walk(root);
  const fileSet = new Set(walked.map((file) => file.relative));
  const files = [];
  const dependencyGraph = {};
  const externalDependencies = new Set();
  const unresolvedRelativeImports = [];

  for (const file of walked) {
    let content = "";
    try {
      content = await readFile(file.absolute, "utf8");
    } catch {
      continue;
    }
    const imports = SOURCE_EXTENSIONS.includes(file.extension) ? extractImportSpecifiers(content) : [];
    const resolved = [];
    for (const specifier of imports) {
      if (specifier.startsWith(".")) {
        const target = resolveRelativeImport(file.relative, specifier, fileSet);
        if (target) resolved.push(target);
        else unresolvedRelativeImports.push({ importer: file.relative, specifier });
      } else if (!specifier.startsWith("node:")) {
        externalDependencies.add(specifier.split("/").slice(0, specifier.startsWith("@") ? 2 : 1).join("/"));
      }
    }
    dependencyGraph[file.relative] = [...new Set(resolved)].sort();
    const kind = classifyFile(file.relative);
    files.push({
      path: file.relative,
      kind,
      bytes: Buffer.byteLength(content),
      route: ["api-route", "page"].includes(kind) ? routePathFromFile(file.relative) : null,
    });
  }

  const reverseGraph = {};
  for (const file of files) reverseGraph[file.path] = [];
  for (const [importer, dependencies] of Object.entries(dependencyGraph)) {
    for (const dependency of dependencies) {
      reverseGraph[dependency] ||= [];
      reverseGraph[dependency].push(importer);
    }
  }
  for (const dependents of Object.values(reverseGraph)) dependents.sort();

  const testLinks = linkTests(files, dependencyGraph);
  const kindCounts = files.reduce((counts, file) => {
    counts[file.kind] = (counts[file.kind] || 0) + 1;
    return counts;
  }, {});

  return {
    schemaVersion: 1,
    generatedAt: new Date().toISOString(),
    root: path.basename(root),
    summary: {
      files: files.length,
      kinds: kindCounts,
      externalDependencies: externalDependencies.size,
      unresolvedRelativeImports: unresolvedRelativeImports.length,
    },
    routes: files.filter((file) => file.route).map(({ path: filePath, kind, route }) => ({ path: filePath, kind, route })),
    workflows: files.filter((file) => file.kind === "workflow").map((file) => file.path),
    migrations: files.filter((file) => file.kind === "migration").map((file) => file.path),
    hotspots: calculateHotspots(files, dependencyGraph, reverseGraph, testLinks),
    testLinks,
    dependencyGraph,
    reverseDependencyGraph: reverseGraph,
    unresolvedRelativeImports,
    externalDependencies: [...externalDependencies].sort(),
  };
}

function parseArgs(argv) {
  const options = { root: process.cwd(), json: false, check: false, output: null };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--root") options.root = argv[++index];
    else if (arg === "--json") options.json = true;
    else if (arg === "--check") options.check = true;
    else if (arg === "--output") options.output = argv[++index];
    else throw new Error(`Unknown argument: ${arg}`);
  }
  return options;
}

function humanSummary(map) {
  const kinds = Object.entries(map.summary.kinds).sort((a, b) => b[1] - a[1]).map(([kind, count]) => `${kind}=${count}`).join(", ");
  const hotspots = map.hotspots.slice(0, 12).map((item) => `- ${item.path} (${item.kind}, score ${item.score}, in ${item.incoming}, out ${item.outgoing}, tests ${item.tests})`).join("\n");
  return [
    "NAVIXA Repo Intelligence",
    `files: ${map.summary.files}`,
    `kinds: ${kinds}`,
    `external dependencies: ${map.summary.externalDependencies}`,
    `unresolved relative imports: ${map.summary.unresolvedRelativeImports}`,
    "hotspots:",
    hotspots || "- none",
  ].join("\n");
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  const map = await buildRepositoryMap(options.root);
  const payload = `${JSON.stringify(map, null, 2)}\n`;
  if (options.output) await writeFile(path.resolve(options.output), payload, "utf8");
  if (options.json) process.stdout.write(payload);
  else process.stdout.write(`${humanSummary(map)}\n`);
  if (options.check && map.summary.files === 0) process.exitCode = 1;
}

const isDirect = process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1]);
if (isDirect) {
  main().catch((error) => {
    console.error(`NAVIXA Repo Intelligence failed: ${error.message}`);
    process.exitCode = 1;
  });
}
