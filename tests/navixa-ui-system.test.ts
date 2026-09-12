import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const shellPath = new URL("../app/ui-system/NavixaShell.tsx", import.meta.url);
const overlayPath = new URL("../app/ui-system/Overlay.tsx", import.meta.url);
const primitivesPath = new URL("../app/ui-system/Primitives.tsx", import.meta.url);
const stylesPath = new URL("../app/ui-system/ui-system.module.css", import.meta.url);
const labPagePath = new URL("../app/ui-lab/page.tsx", import.meta.url);
const labClientPath = new URL("../app/ui-lab/UILabClient.tsx", import.meta.url);

const externalUiDependency = /(?:from\s+|import\s+)["'][^"']*(?:@radix-ui|shadcn|@ionic|framework7|lucide|@mui|chakra-ui|mantine)[^"']*["']/i;

test("NAVIXA UI System stays owned by the repository without third-party UI runtime imports", async () => {
  const files = await Promise.all([
    readFile(shellPath, "utf8"),
    readFile(overlayPath, "utf8"),
    readFile(primitivesPath, "utf8"),
    readFile(labClientPath, "utf8"),
  ]);

  for (const source of files) assert.doesNotMatch(source, externalUiDependency);
});

test("responsive shell has intentional mobile, tablet, desktop and safe-area contracts", async () => {
  const [shell, styles] = await Promise.all([readFile(shellPath, "utf8"), readFile(stylesPath, "utf8")]);

  assert.match(shell, /aria-expanded=\{mobileMenuOpen\}/);
  assert.match(shell, /aria-controls="navixa-mobile-navigation"/);
  assert.match(shell, /styles\.bottomNav/);
  assert.match(styles, /@media \(max-width: 767px\)/);
  assert.match(styles, /@media \(min-width: 768px\) and \(max-width: 1199px\)/);
  assert.match(styles, /env\(safe-area-inset-bottom\)/);
  assert.match(styles, /grid-template-columns: var\(--nx-sidebar-wide\) minmax\(0, 1fr\)/);
  assert.match(styles, /prefers-reduced-motion: reduce/);
});

test("owned overlay implements dialog semantics, keyboard close and focus containment", async () => {
  const overlay = await readFile(overlayPath, "utf8");

  assert.match(overlay, /role="dialog"/);
  assert.match(overlay, /aria-modal="true"/);
  assert.match(overlay, /event\.key === "Escape"/);
  assert.match(overlay, /event\.key !== "Tab"/);
  assert.match(overlay, /previousActive\?\.focus\(\)/);
  assert.match(overlay, /document\.body\.style\.overflow = "hidden"/);
});

test("UI lab is isolated from public discovery while remaining a real App Router preview", async () => {
  const page = await readFile(labPagePath, "utf8");

  assert.match(page, /robots: \{ index: false, follow: false \}/);
  assert.match(page, /<UILabClient \/>/);
});
