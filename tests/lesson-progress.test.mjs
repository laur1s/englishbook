import assert from "node:assert/strict";
import test from "node:test";

import {
  completeLessonStudy,
  getLessonStudyState,
  parseLessonProgress,
  resetLessonStudy,
  setLessonStudyStep,
  uncompleteLessonStudy,
} from "../src/lib/lesson-progress.ts";

const NOW = "2026-07-01T10:00:00.000Z";

test("malformed lesson progress falls back to an empty record", () => {
  assert.deepEqual(parseLessonProgress("not json"), {});
  assert.deepEqual(parseLessonProgress("[]"), {});
  assert.deepEqual(parseLessonProgress(JSON.stringify({ broken: { completedAt: "nope" } })), {});
});

test("legacy completion records migrate as four checked study steps", () => {
  const progress = parseLessonProgress(
    JSON.stringify({ "unit-01": { completedAt: "2026-06-01T08:00:00.000Z" } }),
  );
  const state = getLessonStudyState(progress, "unit-01");

  assert.equal(state.checkedCount, 4);
  assert.equal(state.isReady, true);
  assert.equal(state.isCompleted, true);
  assert.deepEqual(Object.values(state.steps), [true, true, true, true]);
});

test("a lesson cannot complete before all four evidence steps are checked", () => {
  let progress = {};
  progress = setLessonStudyStep(progress, "unit-02", "notice", true, { now: NOW });
  progress = setLessonStudyStep(progress, "unit-02", "retrieve", true, { now: NOW });
  progress = completeLessonStudy(progress, "unit-02", { now: NOW });

  const state = getLessonStudyState(progress, "unit-02");
  assert.equal(state.checkedCount, 2);
  assert.equal(state.isReady, false);
  assert.equal(state.isCompleted, false);
  assert.equal(progress["unit-02"].completedAt, undefined);
});

test("checking all steps enables explicit completion without mutating prior state", () => {
  const initial = {};
  let progress = initial;

  for (const stepId of ["notice", "retrieve", "produce", "correct"]) {
    progress = setLessonStudyStep(progress, "unit-03", stepId, true, { now: NOW });
  }

  assert.equal(getLessonStudyState(progress, "unit-03").isReady, true);
  assert.equal(getLessonStudyState(progress, "unit-03").isCompleted, false);

  const completed = completeLessonStudy(progress, "unit-03", { now: NOW });
  assert.equal(getLessonStudyState(completed, "unit-03").isCompleted, true);
  assert.equal(completed["unit-03"].completedAt, NOW);
  assert.deepEqual(initial, {});
});

test("marking incomplete preserves evidence, while removing evidence invalidates completion", () => {
  const legacy = parseLessonProgress(
    JSON.stringify({ "unit-04": { completedAt: "2026-06-01T08:00:00.000Z" } }),
  );
  const incomplete = uncompleteLessonStudy(legacy, "unit-04", { now: NOW });

  assert.equal(getLessonStudyState(incomplete, "unit-04").checkedCount, 4);
  assert.equal(getLessonStudyState(incomplete, "unit-04").isCompleted, false);

  const revised = setLessonStudyStep(legacy, "unit-04", "correct", false, { now: NOW });

  assert.equal(getLessonStudyState(revised, "unit-04").checkedCount, 3);
  assert.equal(getLessonStudyState(revised, "unit-04").isCompleted, false);
  assert.equal(revised["unit-04"].completedAt, undefined);
  assert.deepEqual(resetLessonStudy(revised, "unit-04"), {});
});

test("legacy revision 1 evidence never satisfies a revised lesson", () => {
  const legacy = parseLessonProgress(
    JSON.stringify({ "unit-12": { completedAt: "2026-06-01T08:00:00.000Z" } }),
  );

  assert.equal(getLessonStudyState(legacy, "unit-12", 1).isCompleted, true);
  assert.equal(getLessonStudyState(legacy, "unit-12", 2).checkedCount, 0);
  assert.equal(getLessonStudyState(legacy, "unit-12", 2).isCompleted, false);

  let revised = legacy;
  for (const stepId of ["notice", "retrieve", "produce", "correct"]) {
    revised = setLessonStudyStep(revised, "unit-12", stepId, true, {
      now: NOW,
      revision: 2,
    });
  }
  revised = completeLessonStudy(revised, "unit-12", { now: NOW, revision: 2 });

  assert.equal(getLessonStudyState(revised, "unit-12", 2).isCompleted, true);
  assert.equal(revised["unit-12"].revision, 2);
  assert.equal(revised["unit-12"].schemaVersion, 2);
});
