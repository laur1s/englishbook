import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";

import { parseDocument } from "../src/lib/markdown.ts";
import {
  generatePracticePack,
  practiceCatalog,
} from "../src/lib/practice/index.ts";

const root = fileURLToPath(new URL("../", import.meta.url));
const manifest = JSON.parse(readFileSync(path.join(root, "learning/course-path.json"), "utf8"));
const sessions = manifest.modules.flatMap((module) => module.sessions);

const stripQuotes = (value) => {
  const trimmed = value.trim();
  return (
    (trimmed.startsWith('"') && trimmed.endsWith('"')) ||
    (trimmed.startsWith("'") && trimmed.endsWith("'"))
  )
    ? trimmed.slice(1, -1)
    : trimmed;
};

const readMarkdownDocument = (filePath) => {
  const source = readFileSync(filePath, "utf8");
  const match = source.match(/^---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)/);
  assert.ok(match, `${filePath} must have frontmatter`);
  const scalar = (field) => {
    const fieldMatch = match[1].match(new RegExp(`^${field}:\\s*(.+?)\\s*$`, "m"));
    return fieldMatch ? stripQuotes(fieldMatch[1]) : "";
  };

  return {
    slug: scalar("slug"),
    title: scalar("title"),
    ltTitle: scalar("ltTitle"),
    body: source.slice(match[0].length),
  };
};

const unitDocuments = new Map(
  readdirSync(root)
    .filter((name) => /^unit-\d{2}.*\.md$/.test(name))
    .map((name) => {
      const document = readMarkdownDocument(path.join(root, name));
      return [`/a2/${document.slug}`, document];
    }),
);

test("all 120 course sessions persist an explicit positive revision", () => {
  assert.equal(sessions.length, 120);

  for (const session of sessions) {
    assert.equal(
      Object.hasOwn(session, "revision"),
      true,
      `${session.id} relies on an implicit revision`,
    );
    assert.ok(
      Number.isInteger(session.revision) && session.revision > 0,
      `${session.id} has an invalid revision`,
    );
  }
});

test("every course content fragment is a real ID produced from its source document", () => {
  const fragmentSessions = sessions.filter(
    (session) => session.kind === "content" && session.href.includes("#"),
  );
  assert.equal(fragmentSessions.length, 12);

  for (const session of fragmentSessions) {
    const target = new URL(session.href, "https://english-library.invalid");
    const document = unitDocuments.get(target.pathname);
    assert.ok(document, `${session.id} targets an unknown source route ${target.pathname}`);

    const parsed = parseDocument({
      markdown: document.body,
      title: document.title,
      ltTitle: document.ltTitle,
    });
    const renderedIds = parsed.sections.map((section) => section.id);

    assert.equal(
      new Set(renderedIds).size,
      renderedIds.length,
      `${target.pathname} produces duplicate section IDs`,
    );
    assert.ok(
      renderedIds.includes(target.hash.slice(1)),
      `${session.id} targets missing rendered/source ID ${target.hash}`,
    );
  }
});

test("every manifest practice count fits its eligible bank and generates in full", () => {
  const practiceSessions = sessions.filter((session) => session.kind === "practice");
  const unitsById = new Map(practiceCatalog.units.map((unit) => [unit.unitId, unit]));
  const itemOwners = new Map(
    practiceCatalog.units.flatMap((unit) =>
      unit.items.map((item) => [item.id, unit.unitId]),
    ),
  );
  assert.equal(practiceSessions.length, 48);

  for (const session of practiceSessions) {
    const targetUnitIds = session.unitIds ?? [session.unitId];
    const eligibleItems = targetUnitIds.flatMap((unitId) => {
      const unit = unitsById.get(unitId);
      assert.ok(unit, `${session.id} targets missing practice bank ${unitId}`);
      return unit.items;
    });

    assert.ok(
      session.count <= eligibleItems.length,
      `${session.id} requests ${session.count} items from a bank of ${eligibleItems.length}`,
    );

    const pack = generatePracticePack({
      ...(session.unitIds ? { unitIds: session.unitIds } : { unitId: session.unitId }),
      mode: session.mode,
      count: session.count,
      attempt: 1,
    });
    const generatedIds = pack.items.map((item) => item.id);

    assert.equal(generatedIds.length, session.count, `${session.id} generated too few items`);
    assert.equal(new Set(generatedIds).size, session.count, `${session.id} repeated an item`);
    assert.ok(
      generatedIds.every((itemId) => targetUnitIds.includes(itemOwners.get(itemId))),
      `${session.id} generated an item outside its configured range`,
    );

    if (session.mode === "checkpoint") {
      assert.deepEqual(
        [...new Set(generatedIds.map((itemId) => itemOwners.get(itemId)))].sort(),
        [...targetUnitIds].sort(),
        `${session.id} does not represent every checkpoint unit`,
      );
    }
  }
});
