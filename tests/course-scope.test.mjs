import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const read = (relativePath) =>
  readFileSync(new URL(`../${relativePath}`, import.meta.url), "utf8");

const manifest = JSON.parse(read("learning/course-path.json"));
const module12 = manifest.modules.find((module) => module.id === "module-12");
const module24 = manifest.modules.find((module) => module.id === "module-24");

test("public project scope consistently describes the 24-module learning path", () => {
  const readme = read("README.md");
  const maintenanceGuide = read("agents.md");
  const homePage = read("src/pages/index.astro");
  const a2Index = read("src/pages/a2/index.astro");
  const speakingIndex = read("src/pages/speaking/index.astro");

  assert.equal(manifest.modules.length, 24);
  assert.equal(manifest.modules.flatMap((module) => module.sessions).length, 120);
  assert.match(readme, /120-session guided path/);
  assert.match(readme, /Each of the 24 modules/);
  assert.match(maintenanceGuide, /24-module, 120-session continuous learning path/);
  assert.match(homePage, /Twelve chapters designed to be read in order/);
  assert.doesNotMatch(homePage, /Ten chapters designed to be read in order/);
  assert.match(a2Index, /A2\.1–A2\.4 are internal course stages within CEFR A2/);
  assert.match(speakingIndex, /A2\.1–A2\.4 are internal stages within CEFR A2/);

  for (const [name, source] of [
    ["README", readme],
    ["maintenance guide", maintenanceGuide],
    ["home page", homePage],
    ["A2 index", a2Index],
    ["speaking index", speakingIndex],
  ]) {
    assert.doesNotMatch(source, /12-module|60-session/i, `${name} has stale course scope`);
  }
});

test("Unit 12 is an interim A2.2 checkpoint and cannot claim completion when opened", () => {
  const unit12 = read("unit-12-review-and-consolidation.md");
  const mission12 = read("speaking/mission-12-a2-real-life-challenge.md");
  const answerKey = read("answer-key.md");
  const learnSession = module12.sessions.find((session) => session.stage === "learn");
  const reviewSession = module12.sessions.find((session) => session.stage === "review");

  assert.equal(module12.title, "A2.2 checkpoint");
  assert.equal(learnSession.title, "Consolidate Units 1–12");
  assert.equal(learnSession.revision, 2);
  assert.equal(reviewSession.title, "Complete the A2.2 checkpoint");
  assert.equal(manifest.modules[manifest.modules.indexOf(module12) + 1].id, "module-13");

  assert.match(unit12, /Opening this lesson does not complete the checkpoint/);
  assert.match(unit12, /continue to Unit 13/);
  assert.doesNotMatch(unit12, /You have completed (?:the )?(?:A2|course)/i);
  assert.doesNotMatch(unit12, /Checkpoint Complete|Final Assessment|B1 Preparation/i);
  assert.doesNotMatch(answerKey, /You have now completed the full A2/i);
  assert.match(mission12, /checkpoint mission/);
  assert.match(mission12, /Units 13–24 continue the A2 path/);
  assert.doesNotMatch(mission12, /This final mission|completed the (?:A2 )?course/i);
});

test("only the Unit 24 review is the final full-course checkpoint", () => {
  const module12Review = module12.sessions.find((session) => session.stage === "review");
  const module24Review = module24.sessions.find((session) => session.stage === "review");

  assert.doesNotMatch(module12Review.title, /final/i);
  assert.match(module24Review.title, /final/i);
  assert.equal(module24Review.unitIds.length, 24);
});

test("Unit 12 correction key preserves the intended negative meaning", () => {
  const answerKey = read("answer-key.md");
  const unit12Key = answerKey.split("## Unit 12: Review and Consolidation")[1]
    .split("## Unit 13: Determiners and Everyday Objects")[0];

  assert.match(unit12Key, /She doesn't like coffee\./);
  assert.doesNotMatch(unit12Key, /She likes coffee\./);
  assert.match(unit12Key, /1\. have lived, has lived/);
});
