import assert from "node:assert/strict";
import test from "node:test";

import {
  extractA2AnswerSnippet,
  extractGreyAnswerSnippet,
} from "../src/lib/answers.ts";

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
