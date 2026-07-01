import assert from "node:assert/strict";
import test from "node:test";

import {
  DAILY_RECALL_MAX_ITEMS,
  buildDailyRecallPlan,
} from "../src/lib/daily-recall.ts";
import { createLearningProgress } from "../src/lib/learning-progress.ts";
import { generatePracticePackFromCatalog } from "../src/lib/practice/generator.ts";

const makeItem = (unitNumber, objective, number) => ({
  id: `u${unitNumber}.${objective}.${String(number).padStart(3, "0")}`,
  revision: 1,
  objectiveId: `u${unitNumber}.${objective}`,
  difficulty: (number % 3) + 1,
  prompt: { en: `Prompt ${number}`, lt: `Užduotis ${number}` },
  rationale: { en: "A short reason.", lt: "Trumpas paaiškinimas." },
  sourceRefs: [{ lesson: `unit-${unitNumber}`, exercise: 1 }],
  type: "single-choice",
  choices: [
    { id: "a", text: "First" },
    { id: "b", text: "Second" },
  ],
  answer: { choiceId: "a" },
});

const makeUnit = (unitNumber, objectiveNames) => {
  const objectives = objectiveNames.map((name) => ({
    id: `u${unitNumber}.${name}`,
    label: { en: name, lt: name },
  }));
  const items = objectiveNames.flatMap((name, objectiveIndex) =>
    Array.from({ length: 4 }, (_, index) =>
      makeItem(unitNumber, name, objectiveIndex * 4 + index + 1)
    )
  );

  return {
    schemaVersion: 1,
    unitId: `unit-${unitNumber}`,
    contentVersion: 1,
    title: `Unit ${unitNumber}`,
    objectives,
    items,
  };
};

const catalog = {
  schemaVersion: 1,
  generatorVersion: 3,
  sourceHash: `sha256-${"a".repeat(64)}`,
  units: [
    makeUnit("03", ["past"]),
    makeUnit("01", ["be-forms", "questions"]),
    makeUnit("02", ["routines"]),
    makeUnit("04", ["places"]),
  ],
};

const makeSkill = (overrides = {}) => ({
  strength: 0.9,
  stage: 2,
  intervalDays: 7,
  lastSeenAt: "2026-06-20T08:00:00.000Z",
  dueAt: "2026-07-10T08:00:00.000Z",
  lapses: 0,
  successfulReviews: 2,
  lastGrade: "good",
  sourceSessionId: "module-review",
  ...overrides,
});

test("mistakes become item priorities before due and developing objectives", () => {
  const progress = createLearningProgress();
  progress.preferences.dailyMinutes = 10;
  progress.mistakeItemRefs = [
    { id: "stale-item", revision: 1 },
    { id: "u02.routines.003", revision: 1 },
    { id: "u02.routines.001", revision: 1 },
    { id: "u02.routines.003", revision: 1 },
  ];
  progress.skills = {
    "u04.places": makeSkill(),
    "u03.past": makeSkill({ strength: 0.64, lastGrade: "hard" }),
    "u01.questions": makeSkill({
      dueAt: "2026-06-28T08:00:00.000Z",
      lapses: 1,
    }),
    "speaking.a2-delivery": makeSkill({ dueAt: "2026-06-01T08:00:00.000Z" }),
  };

  const plan = buildDailyRecallPlan(
    catalog,
    progress,
    "2026-07-01T08:00:00.000Z",
  );

  assert.deepEqual(plan, {
    mode: "review",
    unitIds: ["unit-01", "unit-02", "unit-03"],
    targetObjectiveIds: [
      "u02.routines",
      "u01.questions",
      "u03.past",
    ],
    priorityItemIds: ["u02.routines.001", "u02.routines.003"],
    count: 8,
    minutes: 10,
    emptyReason: null,
  });

  const pack = generatePracticePackFromCatalog(catalog, plan);
  assert.equal(pack.mode, "review");
  assert.deepEqual(pack.unitIds, plan.unitIds);
  assert.ok(plan.priorityItemIds.includes(pack.items[0].id));
});

test("planning is deterministic across catalog and skill insertion order", () => {
  const firstProgress = createLearningProgress();
  firstProgress.mistakeItemRefs = [
    { id: "u02.routines.003", revision: 1 },
    { id: "u01.be-forms.002", revision: 1 },
  ];
  firstProgress.skills = {
    "u03.past": makeSkill({ strength: 0.7, lastGrade: "hard" }),
    "u01.questions": makeSkill({ strength: 0.7, lastGrade: "hard" }),
  };
  const secondProgress = createLearningProgress();
  secondProgress.mistakeItemRefs = [
    { id: "u01.be-forms.002", revision: 1 },
    { id: "u02.routines.003", revision: 1 },
  ];
  secondProgress.skills = {
    "u01.questions": firstProgress.skills["u01.questions"],
    "u03.past": firstProgress.skills["u03.past"],
  };
  const reorderedCatalog = { ...catalog, units: [...catalog.units].reverse() };
  const now = "2026-07-01T08:00:00.000Z";

  const first = buildDailyRecallPlan(catalog, firstProgress, now);
  const second = buildDailyRecallPlan(reorderedCatalog, secondProgress, now);

  assert.deepEqual(first, second);
  assert.equal(JSON.stringify(first), JSON.stringify(second));
});

test("the short-session budget respects 5, 10, and 15 minute goals", () => {
  const expected = new Map([
    [5, { count: 4, minutes: 5 }],
    [10, { count: 8, minutes: 10 }],
    [15, { count: DAILY_RECALL_MAX_ITEMS, minutes: 10 }],
  ]);

  for (const [dailyMinutes, budget] of expected) {
    const progress = createLearningProgress();
    progress.preferences.dailyMinutes = dailyMinutes;
    progress.skills["u01.be-forms"] = makeSkill({ strength: 0.5 });

    const plan = buildDailyRecallPlan(
      catalog,
      progress,
      "2026-07-01T08:00:00.000Z",
    );

    assert.equal(plan.count, budget.count);
    assert.equal(plan.minutes, budget.minutes);
  }
});

test("small represented pools lower both count and time estimate", () => {
  const tinyCatalog = {
    ...catalog,
    units: [{
      ...makeUnit("01", ["be-forms"]),
      items: [
        makeItem("01", "be-forms", 1),
        makeItem("01", "be-forms", 2),
        makeItem("01", "be-forms", 3),
      ],
    }],
  };
  const progress = createLearningProgress();
  progress.preferences.dailyMinutes = 15;
  progress.mistakeItemRefs = [{ id: "u01.be-forms.001", revision: 1 }];

  const plan = buildDailyRecallPlan(
    tinyCatalog,
    progress,
    "2026-07-01T08:00:00.000Z",
  );

  assert.equal(plan.count, 3);
  assert.equal(plan.minutes, 4);
});

test("stale IDs are ignored and never pull unrelated catalog units into scope", () => {
  const progress = createLearningProgress();
  progress.mistakeItemIds = ["removed-item", "removed-item"];
  progress.skills = {
    "u99.removed-objective": makeSkill({ strength: 0.2 }),
    "u04.places": makeSkill(),
  };

  assert.deepEqual(
    buildDailyRecallPlan(catalog, progress, "2026-07-01T08:00:00.000Z"),
    {
      mode: "review",
      unitIds: [],
      targetObjectiveIds: [],
      priorityItemIds: [],
      count: 0,
      minutes: 0,
      emptyReason: "no-matching-catalog-content",
    },
  );
});

test("listening evidence is not misrepresented by an unrelated catalog practice pack", () => {
  const progress = createLearningProgress();
  progress.skills["listening.a2-comprehension"] = makeSkill({
    dueAt: "2026-06-30T08:00:00.000Z",
    sourceSessionId: "module-01-speak",
  });

  assert.deepEqual(
    buildDailyRecallPlan(catalog, progress, "2026-07-01T08:00:00.000Z"),
    {
      mode: "review",
      unitIds: [],
      targetObjectiveIds: [],
      priorityItemIds: [],
      count: 0,
      minutes: 0,
      emptyReason: "no-matching-catalog-content",
    },
  );
});

test("a revised catalog item does not inherit stale mistake priority", () => {
  const revisedCatalog = structuredClone(catalog);
  const revisedItem = revisedCatalog.units
    .flatMap((unit) => unit.items)
    .find((item) => item.id === "u02.routines.001");
  revisedItem.revision = 2;
  const progress = createLearningProgress();
  progress.mistakeItemRefs = [{ id: revisedItem.id, revision: 1 }];

  assert.deepEqual(
    buildDailyRecallPlan(revisedCatalog, progress, "2026-07-01T08:00:00.000Z"),
    {
      mode: "review",
      unitIds: [],
      targetObjectiveIds: [],
      priorityItemIds: [],
      count: 0,
      minutes: 0,
      emptyReason: "no-matching-catalog-content",
    },
  );
});

test("a learner with no actionable review receives a distinct caught-up reason", () => {
  const progress = createLearningProgress();
  progress.skills["u04.places"] = makeSkill();

  const plan = buildDailyRecallPlan(
    catalog,
    progress,
    "2026-07-01T08:00:00.000Z",
  );

  assert.equal(plan.emptyReason, "nothing-due");
  assert.deepEqual(plan.unitIds, []);
});

test("the planner is pure and rejects an invalid clock", () => {
  const progress = createLearningProgress();
  progress.mistakeItemRefs = [{ id: "u01.be-forms.001", revision: 1 }];
  const before = structuredClone(progress);

  buildDailyRecallPlan(catalog, progress, "2026-07-01T08:00:00.000Z");

  assert.deepEqual(progress, before);
  assert.throws(
    () => buildDailyRecallPlan(catalog, progress, "not-a-date"),
    /must be a valid timestamp/,
  );
});
