import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const read = (relativePath) =>
  readFileSync(new URL(`../${relativePath}`, import.meta.url), "utf8");

const chapters = Array.from({ length: 12 }, (_, index) =>
  read(`Grey's book/chapter-${String(index + 1).padStart(2, "0")}.md`),
);
const answerKey = read("Grey's book/answers.md");
const maintenanceGuide = read("Grey's book/agents.md");

test("Grey's Book keeps past-modal speculation out of the A2 reader", () => {
  const pastModalPattern = /\b(?:must|might|could(?: not|n't)?|should|would) have\b/i;

  chapters.forEach((chapter, index) => {
    assert.doesNotMatch(
      chapter,
      pastModalPattern,
      `Chapter ${index + 1} contains a past-modal form above the A2 progression`,
    );
  });
  assert.doesNotMatch(answerKey, pastModalPattern);
  assert.match(maintenanceGuide, /Do not teach past modal speculation/);
});

test("Chapter 10 now teaches A2 event order and reasons", () => {
  const chapter10 = chapters[9];
  const chapter10Answers = answerKey
    .split("### Chapter 10 Understanding")[1]
    .split("### Chapter 11 Understanding")[0];

  assert.match(chapter10, /"Past Simple for events"/);
  assert.match(chapter10, /"Because and so for reasons and results"/);
  assert.match(chapter10, /Put the verbs in the Past Simple/);
  assert.match(chapter10, /Join each pair with `because` or `so`/);
  assert.doesNotMatch(chapter10, /later-level extension|past speculation/i);
  assert.match(chapter10Answers, /Past Simple/i);
  assert.match(chapter10Answers, /because|so/i);
});

test("the final reader chapters form one continuous mission arc", () => {
  assert.match(chapters[9], /six-week mission this summer/i);
  assert.match(chapters[10], /small clinic in the mountains/i);
  assert.match(chapters[11], /vaccination day in a village/i);
  assert.match(chapters[11], /community health/i);
});
