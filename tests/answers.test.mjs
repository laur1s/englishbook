import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";

import {
  extractA2AnswerSnippet,
  extractGreyAnswerSnippet,
  requireA2AnswerSnippet,
  requireGreyAnswerSnippet,
} from "../src/lib/answers.ts";
import { runContentAudit } from "../scripts/audit-content.mjs";

test("A2 extraction tolerates heading punctuation and removes the outer unit heading", () => {
  const snippet = extractA2AnswerSnippet(
    {
      body: `## Unit 1 — Introductions

### Exercise 1
1. am

## Unit 2: Routines
### Exercise 1
1. work`,
    },
    { data: { order: 1 } },
  );

  assert.equal(snippet, "### Exercise 1\n1. am");
  assert.doesNotMatch(snippet, /^##\s+Unit/m);
});

test("A2 extraction does not confuse Unit 1 with Unit 10", () => {
  const snippet = extractA2AnswerSnippet(
    { body: "## Unit 10: Contrast\nWrong\n\n## Unit 1: Basics\nCorrect" },
    { data: { order: 1 } },
  );

  assert.equal(snippet, "Correct");
});

test("Grey extraction keeps answer labels while removing repeated chapter prefixes", () => {
  const snippet = extractGreyAnswerSnippet(
    {
      body: `### Chapter 1 Understanding
1. Answer

### Chapter 1 Fun Activities
- Model

### Chapter 1 Grammar Practice
1. works

### Chapter 2 Understanding
1. Next`,
    },
    { data: { order: 1 } },
  );

  assert.match(snippet, /^### Understanding/);
  assert.match(snippet, /^### Fun Activities/m);
  assert.match(snippet, /^### Grammar Practice/m);
  assert.doesNotMatch(snippet, /Chapter 1/);
  assert.doesNotMatch(snippet, /Chapter 2/);
});

test("missing answer headings return an empty snippet", () => {
  assert.equal(
    extractA2AnswerSnippet({ body: "## Unit 2: Routines\nAnswers" }, { data: { order: 1 } }),
    "",
  );
  assert.equal(
    extractGreyAnswerSnippet(
      { body: "### Chapter 2 Understanding\nAnswers" },
      { data: { order: 1 } },
    ),
    "",
  );
});

test("required answer snippets throw when their entry or section is absent", () => {
  const unit = { data: { order: 1, hasAnswerKey: true } };
  const chapter = { data: { order: 1, hasAnswerKey: true } };

  assert.throws(
    () => requireA2AnswerSnippet(undefined, unit),
    /answer-key entry.*missing.*Unit 1/i,
  );
  assert.throws(
    () => requireA2AnswerSnippet(
      { body: "## Unit 2: Other\nAnswers", data: { slug: "a2" } },
      unit,
    ),
    /answer snippet is missing for Unit 1/i,
  );
  assert.throws(
    () => requireGreyAnswerSnippet(undefined, chapter),
    /answer-key entry.*missing.*Chapter 1/i,
  );
  assert.throws(
    () => requireGreyAnswerSnippet(
      { body: "### Chapter 2 Understanding\nAnswers", data: { slug: "grey-book" } },
      chapter,
    ),
    /answer snippet is missing for Chapter 1/i,
  );
});

test("content audit reports a required unit whose answer snippet is absent", () => {
  const root = mkdtempSync(path.join(tmpdir(), "englishbook-answer-audit-"));
  const frontmatter = ({ title, slug, order, hasAnswerKey }) => `---
title: "${title}"
ltTitle: "LT ${title}"
slug: "${slug}"
order: ${order}
hasAnswerKey: ${hasAnswerKey}
---
`;

  try {
    mkdirSync(path.join(root, "Grey's book"));
    mkdirSync(path.join(root, "speaking"));
    writeFileSync(
      path.join(root, "unit-01-test.md"),
      `${frontmatter({ title: "Unit 1", slug: "unit-01", order: 1, hasAnswerKey: true })}
# Unit 1
## Learning Objectives
- Read.
- Write.
- Speak.
## Exercise 1
1. Test.
`,
    );
    writeFileSync(
      path.join(root, "answer-key.md"),
      `${frontmatter({ title: "Answers", slug: "a2", order: 1, hasAnswerKey: false })}
## Unit 2: Other
### Exercise 1
1. Other.
`,
    );
    writeFileSync(
      path.join(root, "Grey's book", "answers.md"),
      `${frontmatter({ title: "Grey answers", slug: "grey-book", order: 2, hasAnswerKey: false })}
## Answers
`,
    );

    const result = runContentAudit({ root });
    assert.ok(
      result.errors.some((error) =>
        /unit-01-test\.md: Required answer snippet is missing for Unit 1\./.test(error)
      ),
      result.errors.join("\n"),
    );
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
