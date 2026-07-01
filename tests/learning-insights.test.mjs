import assert from "node:assert/strict";
import test from "node:test";

import {
  buildMistakeSummary,
  buildMomentumSummary,
  buildSkillQueue,
  formatLastSeen,
} from "../src/lib/learning-insights.ts";
import { createLearningProgress } from "../src/lib/learning-progress.ts";

test("momentum uses a seven-day local calendar window and current revisions", () => {
  const progress = createLearningProgress();
  progress.preferences.dailyMinutes = 10;
  progress.activeDays = ["2026-06-30"];
  progress.activity = [
    {
      id: "a",
      at: "2026-07-01T22:30:00.000Z",
      day: "2026-07-01",
      sessionId: "one",
      type: "practice",
      minutes: 8,
    },
  ];
  progress.sessions.one = {
    revision: 2,
    status: "completed",
    responses: {},
    attempts: 1,
    startedAt: "2026-07-01T22:20:00.000Z",
    updatedAt: "2026-07-01T22:30:00.000Z",
    completedAt: "2026-07-01T22:30:00.000Z",
  };
  progress.skills.strong = {
    strength: 0.9,
    stage: 2,
    intervalDays: 7,
    lastSeenAt: "2026-07-01T22:30:00.000Z",
    dueAt: "2026-07-08T22:30:00.000Z",
    lapses: 0,
    successfulReviews: 0,
    lastGrade: "good",
    sourceSessionId: "one",
  };

  const summary = buildMomentumSummary(
    progress,
    [
      { id: "one", revision: 2, required: true },
      { id: "two", revision: 1, required: true },
      { id: "optional", revision: 1, required: false },
    ],
    "2026-07-01T22:40:00.000Z",
    "Europe/Vilnius",
  );

  assert.equal(summary.days.length, 7);
  assert.equal(summary.days.at(-1).key, "2026-07-02");
  assert.equal(summary.todayMinutes, 8);
  assert.equal(summary.dailyProgress, 0.8);
  assert.equal(summary.coursePercent, 50);
  assert.equal(summary.activeDayCount, 2);
  assert.equal(summary.strongSkills, 1);
});

test("skill queue names catalog objectives and puts overdue skills first", () => {
  const progress = createLearningProgress();
  progress.skills = {
    "u01.greetings": {
      strength: 0.72,
      stage: 1,
      intervalDays: 3,
      lastSeenAt: "2026-06-29T08:00:00.000Z",
      dueAt: "2026-07-10T08:00:00.000Z",
      lapses: 0,
      successfulReviews: 0,
      lastGrade: "hard",
      sourceSessionId: "module-01-practice",
    },
    "u01.be-questions": {
      strength: 0.9,
      stage: 2,
      intervalDays: 7,
      lastSeenAt: "2026-06-30T08:00:00.000Z",
      dueAt: "2026-07-01T08:00:00.000Z",
      lapses: 1,
      successfulReviews: 1,
      lastGrade: "good",
      sourceSessionId: "module-01-review",
    },
  };
  const objectives = {
    "u01.greetings": { label: "Use greetings", unitId: "unit-01", itemCount: 4 },
    "u01.be-questions": { label: "Form questions with be", unitId: "unit-01", itemCount: 5 },
  };

  const queue = buildSkillQueue(
    progress,
    objectives,
    "2026-07-02T08:00:00.000Z",
    "Europe/Vilnius",
  );

  assert.deepEqual(queue.map((skill) => skill.label), [
    "Form questions with be",
    "Use greetings",
  ]);
  assert.equal(queue[0].status, "Due");
  assert.equal(queue[0].lastSeenLabel, "2 days ago");
  assert.equal(queue[1].status, "Developing");
});

test("mistake summary groups stable item IDs by named objective", () => {
  const summary = buildMistakeSummary(
    { mistakeItemIds: ["one", "two", "one", "unknown-item"] },
    {
      one: { objectiveId: "u01.be-forms", unitId: "unit-01" },
      two: { objectiveId: "u01.be-forms", unitId: "unit-01" },
    },
    {
      "u01.be-forms": { label: "Use present forms of be", unitId: "unit-01", itemCount: 4 },
    },
  );

  assert.equal(summary.count, 3);
  assert.equal(summary.groups[0].label, "Use present forms of be");
  assert.equal(summary.groups[0].count, 2);
  assert.equal(summary.groups[1].label, "Mixed English skills");
});

test("relative last-seen labels respect the requested time zone", () => {
  assert.equal(
    formatLastSeen(
      "2026-07-01T22:30:00.000Z",
      "2026-07-02T08:00:00.000Z",
      "Europe/Vilnius",
    ),
    "Today",
  );
});
