import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const source = readFileSync(
  new URL("../a2-2-follow-up-course.md", import.meta.url),
  "utf8",
);

const sectionBetween = (startHeading, endHeading) => {
  const start = source.indexOf(startHeading);
  assert.notEqual(start, -1, `missing heading: ${startHeading}`);
  const end = endHeading ? source.indexOf(endHeading, start + startHeading.length) : source.length;
  assert.notEqual(end, -1, `missing following heading: ${endHeading}`);
  return source.slice(start, end);
};

test("A2.2 follow-up publishes as an optional self-registering resource", () => {
  assert.match(source, /^slug: "a2-2-follow-up-course"$/m);
  assert.match(source, /^collection: "resources"$/m);
  assert.match(source, /^order: 16$/m);
  assert.match(source, /^resourceGroup: "start-plan"$/m);
  assert.match(source, /^level: "A2\.2"$/m);
  assert.match(source, /^hasAnswerKey: true$/m);
  assert.match(source, /^status: "published"$/m);
  assert.match(source, /A2\.2 is an internal stage of this A2 course/);
});

test("the mini-course has five sequenced sessions with local open-task support", () => {
  const sessionHeadings = [...source.matchAll(/^## Session (\d+)\b.*$/gm)];
  assert.deepEqual(sessionHeadings.map((match) => Number(match[1])), [1, 2, 3, 4, 5]);

  sessionHeadings.forEach((heading, index) => {
    const nextHeading = sessionHeadings[index + 1];
    const finalBoundary = source.indexOf("## Final evidence", heading.index);
    if (!nextHeading) assert.notEqual(finalBoundary, -1, "missing final evidence boundary");
    const body = source.slice(
      heading.index,
      nextHeading?.index ?? finalBoundary,
    );
    assert.match(body, /\*\*Model(?: dialogue)?:\*\* \/ Pavyzd/, `Session ${index + 1} needs a local model`);
    assert.match(body, /\*\*Checklist:\*\* \/ Kontrolinis sąrašas:/, `Session ${index + 1} needs a local checklist`);
  });

  assert.match(source, /not automatically graded and do not receive points/);
  assert.match(source, /continue with \[Unit 13: Determiners and Everyday Objects\]/);
});

test("every fixed exercise has a matching local answer-key entry", () => {
  const lesson = sectionBetween("## Session 1", "## Answer Key / Atsakymų raktas");
  const key = sectionBetween("## Answer Key / Atsakymų raktas", "## Recommended next / Ką rinktis toliau");

  for (let exercise = 1; exercise <= 5; exercise += 1) {
    assert.match(lesson, new RegExp(`^### Exercise ${exercise}\\b`, "m"));
    assert.match(key, new RegExp(`^### Exercise ${exercise}\\s*$`, "m"));
  }

  const lessonCounts = [
    (lesson.match(/^\d+\. .*$/gm) ?? []).slice(0, 6).length,
    (sectionBetween("### Exercise 2", "### Use it — Recommend").match(/^\d+\. .*$/gm) ?? []).length,
    (sectionBetween("### Exercise 3", "### Use it — Send").match(/^\d+\. .*$/gm) ?? []).length,
    (sectionBetween("### Exercise 4", "### Use it — Tell").match(/___/g) ?? []).length,
    (sectionBetween("### Exercise 5", "### Final task").match(/^\d+\. .*$/gm) ?? []).length,
  ];
  assert.deepEqual(lessonCounts, [6, 10, 7, 9, 7]);

  for (const [exercise, count] of [[1, 6], [2, 10], [3, 7], [5, 7]]) {
    const start = key.indexOf(`### Exercise ${exercise}`);
    const next = key.indexOf(`### Exercise ${exercise + 1}`, start + 1);
    const answerBlock = key.slice(start, next === -1 ? key.length : next);
    assert.equal((answerBlock.match(/^\d+\. .*$/gm) ?? []).length, count);
  }
  assert.match(key, /were preparing; was carrying; was moving; opened; went; stopped; turned; was checking; came/);
});

test("the final model stays inside the requested A2 message length", () => {
  const match = source.match(
    /\*\*Model:\*\* \/ Pavyzdys:\n\n\*(Hi Ieva, [^*]+)\*/,
  );
  assert.ok(match, "final reply model is missing");

  const wordCount = match[1].trim().split(/\s+/).length;
  assert.ok(wordCount >= 50 && wordCount <= 70, `final model has ${wordCount} words`);
});
