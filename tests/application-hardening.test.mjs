import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const read = (relativePath) =>
  readFileSync(new URL(`../${relativePath}`, import.meta.url), "utf8");

const baseLayout = read("src/layouts/BaseLayout.astro");
const sessionRunner = read("src/components/SessionRunner.astro");

test("R140 translation markers own the popover without returning to the sequential Tab order", () => {
  assert.match(baseLayout, /id="translation-popover"/);
  assert.match(baseLayout, /marker\.setAttribute\("tabindex", "-1"\)/);
  assert.match(baseLayout, /marker\.setAttribute\("aria-controls", translationPopover\.id\)/);
  assert.match(baseLayout, /trigger\.setAttribute\("aria-expanded", "true"\)/);
  assert.match(baseLayout, /translationPopover\.setAttribute\("aria-labelledby", trigger\.id\)/);
  assert.match(baseLayout, /closeTranslationPopover\(\{ restoreFocus: true \}\)/);
  assert.match(baseLayout, /trigger\.focus\(\{ preventScroll: true \}\)/);
  assert.doesNotMatch(baseLayout, /marker\.setAttribute\("tabindex", "0"\)/);
});

test("R144 SessionRunner probes storage and exposes a persistent pre-work warning", () => {
  const warningIndex = sessionRunner.indexOf("data-storage-warning");
  const contentIndex = sessionRunner.indexOf('<section class="embedded-speaking-session"');

  assert.ok(warningIndex > -1 && warningIndex < contentIndex);
  assert.match(sessionRunner, /canUsePersistentStorage\(persistentStorage\)/);
  assert.match(sessionRunner, /if \(!storageAvailable\)/);
  assert.match(sessionRunner, /storageWarning\.hidden = false/);
  assert.match(sessionRunner, /role="alert"/);
});

test("R159 every generated practice input references the feedback panel", () => {
  assert.match(sessionRunner, /id="practice-feedback"/);
  assert.equal(
    sessionRunner.match(/input\.setAttribute\("aria-describedby", "practice-feedback"\)/g)?.length,
    2,
  );
});

test("R160 invalid embedded controller data reveals reload and path recovery actions", () => {
  assert.match(sessionRunner, /data-runner-controller-error/);
  assert.match(sessionRunner, /data-reload-session/);
  assert.match(sessionRunner, />Return to learning path</);
  assert.match(sessionRunner, /const parsedRunnerData = parseRunnerData/);
  assert.match(sessionRunner, /if \(!parsedRunnerData\.ok\)/);
  assert.match(sessionRunner, /controllerError\.hidden = false/);
});

test("R161 required answer helpers are used by reader, answer, and audit surfaces", () => {
  for (const file of ["src/pages/a2/[slug].astro", "src/pages/answers/a2.astro"]) {
    assert.match(read(file), /requireA2AnswerSnippet\(answerEntry,/);
  }
  for (const file of ["src/pages/grey-book/[slug].astro", "src/pages/answers/grey-book.astro"]) {
    assert.match(read(file), /requireGreyAnswerSnippet\(answerEntry,/);
  }
  const audit = read("scripts/audit-content.mjs");
  assert.match(audit, /requireA2AnswerSnippet\(a2Answers, document\)/);
  assert.match(audit, /requireGreyAnswerSnippet\(greyAnswers, document\)/);
});
