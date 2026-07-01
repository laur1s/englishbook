import assert from "node:assert/strict";
import test from "node:test";

import {
  LEGACY_LEARNING_PROGRESS_KEY,
  beginPracticeRepair,
  beginPracticeRun,
  completeLearningSession,
  createLearningProgress,
  getDueSkills,
  getNextLearningSessionId,
  isLearningSessionUnlocked,
  localDayKey,
  migrateLegacyLearningProgress,
  nextPracticeAttempt,
  parseLearningProgress,
  readLearningProgress,
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

test("version 1 progress migrates to version 2 without losing valid learning evidence", () => {
  const legacy = {
    version: 1,
    activeSessionId: "module-01-practice",
    sessions: {
      "module-01-practice": {
        revision: 3,
        status: "completed",
        responses: { "u01.item.001": "am" },
        attempts: 2,
        score: 7,
        total: 8,
        startedAt: "2026-06-01T08:00:00.000Z",
        updatedAt: "2026-06-01T08:12:00.000Z",
        completedAt: "2026-06-01T08:12:00.000Z",
      },
    },
    skills: {
      "u01.be-forms": {
        strength: 0.9,
        intervalDays: 7,
        lastSeenAt: "2026-06-01T08:12:00.000Z",
        dueAt: "2026-06-08T08:12:00.000Z",
        lapses: 1,
        sourceSessionId: "module-01-practice",
      },
    },
    practiceAttempts: { "module-01-practice": 2 },
    recentItemIds: ["u01.item.001"],
    activeDays: ["2026-06-01"],
  };
  const values = new Map([[LEGACY_LEARNING_PROGRESS_KEY, JSON.stringify(legacy)]]);
  const migrated = readLearningProgress({
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, value),
  });

  assert.equal(migrated.version, 2);
  assert.equal(migrated.activeSessionId, "module-01-practice");
  assert.equal(migrated.sessions["module-01-practice"].revision, 3);
  assert.equal(migrated.sessions["module-01-practice"].score, 7);
  assert.equal(migrated.skills["u01.be-forms"].stage, 2);
  assert.equal(migrated.skills["u01.be-forms"].lastGrade, "good");
  assert.equal(migrated.skills["u01.be-forms"].successfulReviews, 0);
  assert.deepEqual(migrated.mistakeItemIds, []);
  assert.deepEqual(migrated.activity, []);
  assert.deepEqual(migrated.preferences, { dailyMinutes: 10 });
});

test("parse normalizes parseable timestamps and drops invalid timestamp records", () => {
  const parsed = parseLearningProgress(JSON.stringify({
    version: 2,
    activeSessionId: "valid",
    sessions: {
      valid: {
        revision: 1,
        status: "completed",
        responses: {},
        attempts: 1,
        startedAt: "2026-07-01T12:00:00+02:00",
        updatedAt: "2026-07-01T12:05:00+02:00",
        completedAt: "2026-07-01T12:05:00+02:00",
      },
      invalid: {
        revision: 1,
        status: "started",
        responses: {},
        attempts: 0,
        startedAt: "not-a-date",
        updatedAt: "still-not-a-date",
      },
    },
    skills: {
      normalized: {
        strength: 0.5,
        intervalDays: 1,
        lastSeenAt: "2026-07-01T12:00:00+02:00",
        dueAt: "2026-07-02T12:00:00+02:00",
        lapses: 0,
        sourceSessionId: "valid",
      },
      invalid: {
        strength: 0.5,
        intervalDays: 1,
        lastSeenAt: "not-a-date",
        dueAt: "also-not-a-date",
        lapses: 0,
        sourceSessionId: "valid",
      },
    },
  }));

  assert.equal(parsed.sessions.valid.startedAt, "2026-07-01T10:00:00.000Z");
  assert.equal(parsed.sessions.valid.completedAt, "2026-07-01T10:05:00.000Z");
  assert.equal(parsed.sessions.invalid, undefined);
  assert.equal(parsed.skills.normalized.dueAt, "2026-07-02T10:00:00.000Z");
  assert.equal(parsed.skills.invalid, undefined);
  assert.deepEqual(getDueSkills(parsed, "2026-07-03T00:00:00.000Z").map(([id]) => id), [
    "normalized",
  ]);
});

test("local day keys follow Europe/Vilnius across UTC midnight", () => {
  assert.equal(localDayKey("2026-06-30T20:59:59.000Z", "Europe/Vilnius"), "2026-06-30");
  assert.equal(localDayKey("2026-06-30T21:00:00.000Z", "Europe/Vilnius"), "2026-07-01");
  assert.equal(localDayKey("2026-07-01T20:59:59.000Z", "Europe/Vilnius"), "2026-07-01");
  assert.equal(localDayKey("2026-07-01T21:00:00.000Z", "Europe/Vilnius"), "2026-07-02");
  assert.equal(localDayKey("not-a-date", "Europe/Vilnius"), "");
});

test("opening a session does not record daily activity", () => {
  const initial = createLearningProgress();
  const started = startLearningSession(
    initial,
    "module-01-context",
    1,
    "2026-07-01T08:00:00.000Z",
  );

  assert.deepEqual(initial.activity, []);
  assert.deepEqual(started.activity, []);
  assert.deepEqual(started.activeDays, []);
});

test("completing meaningful work records activity minutes and its local day", () => {
  const now = "2026-07-01T08:14:00.000Z";
  const completed = completeLearningSession(
    createLearningProgress(),
    "module-01-practice",
    { revision: 2, score: 8, total: 10, minutes: 14, activityType: "practice" },
    now,
  );

  assert.deepEqual(completed.activity, [{
    id: `module-01-practice:${now}`,
    at: now,
    day: localDayKey(now),
    sessionId: "module-01-practice",
    type: "practice",
    minutes: 14,
  }]);
  assert.deepEqual(completed.activeDays, [localDayKey(now)]);
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

test("changing one session revision leaves other completions isolated and unlocks correctly", () => {
  let progress = completeLearningSession(
    createLearningProgress(),
    "session-a",
    { revision: 1 },
    "2026-07-01T08:00:00.000Z",
  );
  progress = completeLearningSession(
    progress,
    "session-b",
    { revision: 1 },
    "2026-07-01T08:05:00.000Z",
  );
  const revisedPath = [
    { id: "session-a", revision: 1, required: true },
    { id: "session-b", revision: 2, required: true },
    { id: "session-c", revision: 1, required: true },
  ];

  assert.equal(getNextLearningSessionId(revisedPath, progress), "session-b");
  assert.equal(isLearningSessionUnlocked(revisedPath, progress, "session-b"), true);
  assert.equal(isLearningSessionUnlocked(revisedPath, progress, "session-c"), false);

  const updated = completeLearningSession(
    progress,
    "session-b",
    { revision: 2 },
    "2026-07-01T08:10:00.000Z",
  );

  assert.equal(updated.sessions["session-a"].revision, 1);
  assert.equal(updated.sessions["session-a"].status, "completed");
  assert.equal(updated.sessions["session-b"].revision, 2);
  assert.equal(isLearningSessionUnlocked(revisedPath, updated, "session-c"), true);
});

test("mistake items persist until each item is successfully repaired", () => {
  const firstPass = completeLearningSession(
    createLearningProgress(),
    "module-01-practice",
    {
      score: 1,
      total: 3,
      itemIds: ["good", "mistake-a", "mistake-b"],
      mistakeItemIds: ["mistake-a", "mistake-b"],
    },
    "2026-07-01T08:00:00.000Z",
  );
  assert.deepEqual(firstPass.mistakeItemIds, ["mistake-a", "mistake-b"]);

  let repairRun = beginPracticeRun(
    firstPass,
    "module-01-practice",
    {
      attempt: 2,
      recentItemIds: ["good", "mistake-a", "mistake-b"],
      priorityItemIds: ["mistake-a", "mistake-b"],
      targetObjectiveIds: ["u01.be-forms"],
      packId: "repair-pack",
      itemRefs: [
        { id: "mistake-a", revision: 1 },
        { id: "mistake-b", revision: 1 },
      ],
    },
    1,
    "2026-07-01T08:01:00.000Z",
  );
  repairRun = beginPracticeRepair(
    repairRun,
    "module-01-practice",
    {
      repairItemIds: ["mistake-a", "mistake-b"],
      firstPassScore: 1,
      firstPassTotal: 3,
      firstPassSkillResults: { "u01.be-forms": { score: 1, total: 3 } },
    },
    "2026-07-01T08:02:00.000Z",
  );
  const restoredRepair = parseLearningProgress(JSON.stringify(repairRun));
  assert.equal(restoredRepair.sessions["module-01-practice"].practiceRun.phase, "repair");
  assert.deepEqual(
    restoredRepair.sessions["module-01-practice"].practiceRun.repairItemIds,
    ["mistake-a", "mistake-b"],
  );
  assert.equal(
    restoredRepair.sessions["module-01-practice"].practiceRun.firstPassScore,
    1,
  );

  const oneRepaired = completeLearningSession(
    restoredRepair,
    "module-01-practice",
    { score: 1, total: 1, itemIds: ["mistake-a"] },
    "2026-07-01T08:05:00.000Z",
  );
  assert.deepEqual(oneRepaired.mistakeItemIds, ["mistake-b"]);

  const allRepaired = completeLearningSession(
    oneRepaired,
    "module-01-practice",
    { score: 1, total: 1, itemIds: ["mistake-b"] },
    "2026-07-01T08:10:00.000Z",
  );
  assert.deepEqual(allRepaired.mistakeItemIds, []);
});

test("an active correction loop exposes mistakes and clears them after repair", () => {
  let progress = beginPracticeRun(
    createLearningProgress(),
    "module-01-practice",
    {
      attempt: 1,
      recentItemIds: [],
      packId: "pack-1",
      itemRefs: [{ id: "missed", revision: 1 }],
    },
    1,
    "2026-07-01T08:00:00.000Z",
  );
  progress = beginPracticeRepair(
    progress,
    "module-01-practice",
    {
      repairItemIds: ["missed"],
      firstPassScore: 0,
      firstPassTotal: 1,
      firstPassSkillResults: { "u01.be-forms": { score: 0, total: 1 } },
    },
    "2026-07-01T08:01:00.000Z",
  );

  assert.deepEqual(progress.mistakeItemIds, ["missed"]);

  const repaired = completeLearningSession(
    progress,
    "module-01-practice",
    { score: 0, total: 1, itemIds: ["missed"], mistakeItemIds: [] },
    "2026-07-01T08:02:00.000Z",
  );
  assert.deepEqual(repaired.mistakeItemIds, []);
});

test("an immediate successful retry cannot grow a skill interval", () => {
  const skillOptions = {
    score: 1,
    total: 1,
    skillRefs: ["u01.be-forms"],
    skillResults: { "u01.be-forms": { score: 1, total: 1 } },
  };
  const learned = completeLearningSession(
    createLearningProgress(),
    "module-01-practice",
    skillOptions,
    "2026-07-01T08:00:00.000Z",
  );
  const retried = completeLearningSession(
    learned,
    "module-01-practice",
    skillOptions,
    "2026-07-01T08:05:00.000Z",
  );

  assert.equal(learned.skills["u01.be-forms"].stage, 2);
  assert.equal(retried.skills["u01.be-forms"].stage, 2);
  assert.equal(retried.skills["u01.be-forms"].intervalDays, 7);
  assert.equal(retried.skills["u01.be-forms"].successfulReviews, 0);
});

test("a due successful recall advances exactly one scheduler stage", () => {
  const skillOptions = {
    score: 1,
    total: 1,
    skillRefs: ["u01.be-forms"],
    skillResults: { "u01.be-forms": { score: 1, total: 1 } },
  };
  const learned = completeLearningSession(
    createLearningProgress(),
    "module-01-practice",
    skillOptions,
    "2026-07-01T08:00:00.000Z",
  );
  const dueAt = learned.skills["u01.be-forms"].dueAt;
  const recalled = completeLearningSession(
    learned,
    "module-01-review",
    skillOptions,
    dueAt,
  );

  assert.equal(recalled.skills["u01.be-forms"].stage, 3);
  assert.equal(recalled.skills["u01.be-forms"].intervalDays, 14);
  assert.equal(recalled.skills["u01.be-forms"].successfulReviews, 1);
  assert.equal(recalled.skills["u01.be-forms"].lastGrade, "good");
  assert.equal(recalled.skills["u01.be-forms"].sourceSessionId, "module-01-review");
});

test("a failed recall resets the scheduler and records a lapse", () => {
  const learned = completeLearningSession(
    createLearningProgress(),
    "module-01-practice",
    {
      score: 1,
      total: 1,
      skillRefs: ["u01.be-forms"],
      skillResults: { "u01.be-forms": { score: 1, total: 1 } },
    },
    "2026-07-01T08:00:00.000Z",
  );
  const failed = completeLearningSession(
    learned,
    "module-01-review",
    {
      score: 0,
      total: 1,
      skillRefs: ["u01.be-forms"],
      skillResults: { "u01.be-forms": { score: 0, total: 1 } },
    },
    learned.skills["u01.be-forms"].dueAt,
  );

  assert.equal(failed.skills["u01.be-forms"].stage, 0);
  assert.equal(failed.skills["u01.be-forms"].intervalDays, 1);
  assert.equal(failed.skills["u01.be-forms"].lastGrade, "again");
  assert.equal(failed.skills["u01.be-forms"].lapses, 1);
  assert.equal(failed.skills["u01.be-forms"].successfulReviews, 0);
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
