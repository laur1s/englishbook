import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";

import { checkSiteLinks, normalizeBasePath } from "../scripts/check-site-links.mjs";

const makeSite = (files) => {
  const rootDirectory = mkdtempSync(path.join(tmpdir(), "english-library-links-"));
  for (const [relativePath, content] of Object.entries(files)) {
    const filePath = path.join(rootDirectory, relativePath);
    mkdirSync(path.dirname(filePath), { recursive: true });
    writeFileSync(filePath, content);
  }
  return rootDirectory;
};

test("generated-site links resolve routes, relative paths, and fragments", (context) => {
  const rootDirectory = makeSite({
    "index.html": '<h1 id="home">Home</h1><a href="/guide#start">Guide</a>',
    "guide/index.html": '<h1 id="start">Guide</h1><a href="../#home">Home</a>',
  });
  context.after(() => rmSync(rootDirectory, { recursive: true, force: true }));

  assert.deepEqual(checkSiteLinks({ rootDirectory }).issues, []);
});

test("generated-site links report missing routes and fragments", (context) => {
  const rootDirectory = makeSite({
    "index.html": [
      '<h1 id="home">Home</h1>',
      '<a href="/missing">Missing page</a>',
      '<a href="/guide#missing">Missing section</a>',
    ].join(""),
    "guide/index.html": '<h1 id="start">Guide</h1>',
  });
  context.after(() => rmSync(rootDirectory, { recursive: true, force: true }));

  const reasons = checkSiteLinks({ rootDirectory }).issues.map((issue) => issue.reason);
  assert.deepEqual(reasons, ["missing route or generated file", "missing fragment #missing"]);
});

test("generated-site links respect a configured deployment base", (context) => {
  const rootDirectory = makeSite({
    "index.html": '<h1 id="home">Home</h1><a href="/englishbook/guide#start">Guide</a>',
    "guide/index.html": '<h1 id="start">Guide</h1>',
  });
  context.after(() => rmSync(rootDirectory, { recursive: true, force: true }));

  assert.equal(normalizeBasePath("englishbook"), "/englishbook/");
  assert.deepEqual(checkSiteLinks({ rootDirectory, basePath: "/englishbook/" }).issues, []);
});
