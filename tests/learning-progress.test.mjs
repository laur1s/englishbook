import assert from "node:assert/strict";
import test from "node:test";

import {
  completeLearningSession,
  createLearningProgress,
  getDueSkills,
  getNextLearningSessionId,
  migrateLegacyLearningProgress,
  nextPracticeAttempt,
  parseLearningProgress,
  startLearningSession,
} from "../src/lib/learning-progress.ts";

test("invalid or stale saved data falls back to a clean learning state", () => {
  assert.deepEqual(parseLearningProgress("not-json"), createLearningProgress());
  assert.deepEqual(parseLearningProgress('{"version":99}'), createLearningProgress());
});

test("the path resumes an active session and advances after completion", () => {
  const sessions = [{ id: "m01-context" }, { id: "m01-learn" }, { id: "m01-practice" }];
  const started = startLearningSession(createLearningProgress(), "m01-context", 1, "2026-07-01T08:00:00.000Z");

  assert.equal(getNextLearningSessionId(sessions, started), "m01-context");

  const completed = completeLearningSession(
    started,
    "m01-context",
    { nextSessionId: "m01-learn" },
    "2026-07-01T08:05:00.000Z",
  );

  assert.equal(completed.sessions["m01-context"].status, "completed");
  assert.equal(getNextLearningSessionId(sessions, completed), "m01-learn");
});

test("practice accuracy schedules deterministic review intervals", () => {
  const completed = completeLearningSession(
    createLearningProgress(),
    "m01-practice",
    {
      score: 4,
      total: 5,
      skillRefs: ["be.identity"],
      itemIds: ["u01.be.i-origin"],
    },
    "2026-07-01T08:00:00.000Z",
  );

  assert.equal(completed.skills["be.identity"].intervalDays, 7);
  assert.equal(completed.skills["be.identity"].dueAt, "2026-07-08T08:00:00.000Z");
  assert.equal(getDueSkills(completed, "2026-07-07T08:00:00.000Z").length, 0);
  assert.equal(getDueSkills(completed, "2026-07-08T08:00:00.000Z").length, 1);
});

test("new practice attempts increment without mutating the previous state", () => {
  const initial = createLearningProgress();
  const next = nextPracticeAttempt(initial, "m01-practice");

  assert.equal(initial.practiceAttempts["m01-practice"], undefined);
  assert.equal(next.practiceAttempts["m01-practice"], 1);
});

test("legacy lesson and speaking completions migrate into the unified path", () => {
  const values = new Map([
    ["english-library.lesson-progress", JSON.stringify({ "unit-01": { completedAt: "2026-06-01T08:00:00.000Z" } })],
    ["english-library.speaking.progress", JSON.stringify({ "introduce-yourself-fast": { completed: true, completedAt: "2026-06-02T08:00:00.000Z" } })],
  ]);
  const storage = {
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, value),
  };

  const migrated = migrateLegacyLearningProgress(storage, [{
    unitSlug: "unit-01",
    learnSessionId: "module-01-learn",
    missionSlug: "introduce-yourself-fast",
    speakSessionId: "module-01-speak",
  }]);

  assert.equal(migrated.sessions["module-01-learn"].status, "completed");
  assert.equal(migrated.sessions["module-01-speak"].status, "completed");
});
