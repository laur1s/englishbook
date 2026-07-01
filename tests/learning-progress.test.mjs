import assert from "node:assert/strict";
import test from "node:test";

import {
  beginPracticeRun,
  completeLearningSession,
  createLearningProgress,
  getDueSkills,
  getNextLearningSessionId,
  isLearningSessionUnlocked,
  migrateLegacyLearningProgress,
  nextPracticeAttempt,
  parseLearningProgress,
  startLearningSession,
} from "../src/lib/learning-progress.ts";

test("invalid or stale saved data falls back to a clean learning state", () => {
  assert.deepEqual(parseLearningProgress("not-json"), createLearningProgress());
  assert.deepEqual(parseLearningProgress('{"version":99}'), createLearningProgress());
});

test("malformed nested progress is sanitized without breaking resume logic", () => {
  const parsed = parseLearningProgress(JSON.stringify({
    version: 1,
    activeSessionId: "bad-session",
    sessions: {
      "bad-session": null,
      valid: {
        revision: 1,
        status: "started",
        responses: { answer: "yes", bad: 9 },
        attempts: 0,
        startedAt: "2026-07-01T08:00:00.000Z",
        updatedAt: "2026-07-01T08:01:00.000Z",
      },
    },
    skills: { broken: null },
    practiceAttempts: { valid: 2, broken: "oops" },
    recentItemIds: ["one", 2],
    activeDays: ["2026-07-01", "not-a-day"],
  }));

  assert.deepEqual(parsed.sessions.valid.responses, { answer: "yes" });
  assert.deepEqual(parsed.skills, {});
  assert.deepEqual(parsed.practiceAttempts, { valid: 2 });
  assert.deepEqual(parsed.recentItemIds, ["one"]);
  assert.deepEqual(parsed.activeDays, ["2026-07-01"]);
  assert.equal(parsed.activeSessionId, null);
  assert.equal(getDueSkills(parsed).length, 0);
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

test("a future active session never bypasses an earlier required step", () => {
  const sessions = [
    { id: "m01-context", revision: 1, required: true },
    { id: "m01-learn", revision: 1, required: true },
    { id: "m01-practice", revision: 1, required: true },
  ];
  const futureStarted = startLearningSession(
    createLearningProgress(),
    "m01-practice",
    1,
    "2026-07-01T08:00:00.000Z",
  );

  assert.equal(futureStarted.activeSessionId, "m01-practice");
  assert.equal(getNextLearningSessionId(sessions, futureStarted), "m01-context");
  assert.equal(isLearningSessionUnlocked(sessions, futureStarted, "m01-practice"), false);
  assert.equal(isLearningSessionUnlocked(sessions, futureStarted, "m01-context"), true);
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

test("mixed practice schedules each objective from its own answers", () => {
  const completed = completeLearningSession(
    createLearningProgress(),
    "m12-review",
    {
      score: 9,
      total: 10,
      skillRefs: ["u01.be-forms", "u12.integration"],
      skillResults: {
        "u01.be-forms": { score: 0, total: 1 },
        "u12.integration": { score: 9, total: 9 },
      },
    },
    "2026-07-01T08:00:00.000Z",
  );

  assert.equal(completed.skills["u01.be-forms"].strength, 0);
  assert.equal(completed.skills["u01.be-forms"].intervalDays, 1);
  assert.equal(completed.skills["u12.integration"].strength, 1);
  assert.equal(completed.skills["u12.integration"].intervalDays, 7);
});

test("a new practice run preserves prior completion and the active linear step", () => {
  let progress = completeLearningSession(
    createLearningProgress(),
    "m01-practice",
    { revision: 2, nextSessionId: "m01-speak" },
    "2026-07-01T08:00:00.000Z",
  );
  progress = startLearningSession(progress, "m01-speak", 2, "2026-07-01T08:01:00.000Z");
  const replay = beginPracticeRun(
    progress,
    "m01-practice",
    {
      attempt: 2,
      recentItemIds: ["u01.one"],
      packId: "pack-2",
      itemRefs: [{ id: "u01.one", revision: 3 }],
    },
    2,
    "2026-07-01T08:02:00.000Z",
  );

  assert.equal(replay.sessions["m01-practice"].status, "completed");
  assert.equal(replay.sessions["m01-practice"].practiceRun.packId, "pack-2");
  assert.deepEqual(replay.sessions["m01-practice"].practiceRun.itemRefs, [
    { id: "u01.one", revision: 3 },
  ]);
  assert.equal(replay.activeSessionId, "m01-speak");
  assert.equal(
    parseLearningProgress(JSON.stringify(replay)).sessions["m01-practice"].practiceRun.packId,
    "pack-2",
  );
});

test("resume selection respects revisions and skips optional sessions", () => {
  const sessions = [
    { id: "required-a", revision: 2, required: true },
    { id: "optional", revision: 1, required: false },
    { id: "required-b", revision: 1, required: true },
  ];
  const stale = completeLearningSession(
    createLearningProgress(),
    "required-a",
    { revision: 1 },
    "2026-07-01T08:00:00.000Z",
  );
  assert.equal(getNextLearningSessionId(sessions, stale), "required-a");

  const current = completeLearningSession(
    stale,
    "required-a",
    { revision: 2 },
    "2026-07-01T08:01:00.000Z",
  );
  assert.equal(getNextLearningSessionId(sessions, current), "required-b");
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
