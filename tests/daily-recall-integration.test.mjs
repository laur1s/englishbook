import assert from "node:assert/strict";
import test from "node:test";

import {
  DAILY_RECALL_REVISION,
  DAILY_RECALL_SESSION_ID,
  buildDailyRecallPlan,
} from "../src/lib/daily-recall.ts";
import {
  beginPracticeRepair,
  beginPracticeRun,
  completeLearningSession,
  createLearningProgress,
  getActiveRepairSessionId,
  readLearningProgress,
  saveLearningResponse,
  startLearningSession,
  writeLearningProgress,
} from "../src/lib/learning-progress.ts";
import {
  generatePracticePackFromCatalog,
  practiceCatalog,
} from "../src/lib/practice/index.ts";

const makeStorage = () => {
  const values = new Map();
  return {
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, value),
  };
};

const responseFor = (item) => item.type === "single-choice"
  ? item.answer.choiceId
  : item.answer.accepted[0];

test("daily recall plans, persists, resumes, and completes without moving the path", () => {
  const now = "2026-07-01T08:00:00.000Z";
  const priorityItems = [
    practiceCatalog.units[0].items[0],
    practiceCatalog.units[1].items[0],
  ];
  let progress = startLearningSession(
    createLearningProgress(),
    "module-01-practice",
    1,
    now,
  );
  progress = {
    ...progress,
    mistakeItemRefs: priorityItems.map((item) => ({
      id: item.id,
      revision: item.revision,
    })),
    mistakeItemIds: priorityItems.map((item) => item.id),
  };

  const plan = buildDailyRecallPlan(practiceCatalog, progress, now);
  assert.equal(plan.emptyReason, null);
  assert.deepEqual(plan.unitIds, ["unit-01", "unit-02"]);

  const pack = generatePracticePackFromCatalog(practiceCatalog, plan);
  assert.equal(pack.items.length, plan.count);
  assert.ok(priorityItems.every((item) => pack.items.some((candidate) => candidate.id === item.id)));

  progress = beginPracticeRun(
    progress,
    DAILY_RECALL_SESSION_ID,
    {
      attempt: pack.attempt,
      recentItemIds: [],
      priorityItemIds: plan.priorityItemIds,
      targetObjectiveIds: plan.targetObjectiveIds,
      packId: pack.id,
      itemRefs: pack.items.map((item) => ({ id: item.id, revision: item.revision })),
      scope: "daily",
      unitIds: plan.unitIds,
      hostSessionId: "module-01-review",
      preserveActiveSession: true,
    },
    DAILY_RECALL_REVISION,
    now,
  );

  const storage = makeStorage();
  assert.equal(writeLearningProgress(storage, progress), true);
  let restored = readLearningProgress(storage);
  assert.equal(restored.activeSessionId, "module-01-practice");
  assert.equal(restored.sessions[DAILY_RECALL_SESSION_ID].practiceRun.scope, "daily");
  assert.deepEqual(restored.sessions[DAILY_RECALL_SESSION_ID].practiceRun.unitIds, plan.unitIds);

  const firstItem = pack.items[0];
  restored = saveLearningResponse(
    restored,
    DAILY_RECALL_SESSION_ID,
    firstItem.id,
    responseFor(firstItem),
    "2026-07-01T08:01:00.000Z",
    true,
  );
  writeLearningProgress(storage, restored);
  restored = readLearningProgress(storage);
  assert.equal(restored.activeSessionId, "module-01-practice");
  assert.equal(restored.sessions[DAILY_RECALL_SESSION_ID].currentItemId, firstItem.id);

  const completed = completeLearningSession(
    restored,
    DAILY_RECALL_SESSION_ID,
    {
      revision: DAILY_RECALL_REVISION,
      score: 1,
      total: 1,
      skillRefs: [firstItem.objectiveId],
      skillResults: { [firstItem.objectiveId]: { score: 1, total: 1 } },
      itemIds: [firstItem.id],
      preserveActiveSession: true,
    },
    "2026-07-01T08:02:00.000Z",
  );

  assert.equal(completed.activeSessionId, "module-01-practice");
  assert.equal(completed.sessions[DAILY_RECALL_SESSION_ID].status, "completed");
  assert.equal(completed.skills[firstItem.objectiveId].sourceSessionId, DAILY_RECALL_SESSION_ID);
  assert.deepEqual(completed.recentItemRefs, [{
    id: firstItem.id,
    revision: firstItem.revision,
  }]);
});

test("repair selection ignores stale revisions and finds the next valid repair", () => {
  let progress = createLearningProgress();
  progress = beginPracticeRun(progress, "module-01-practice", {
    attempt: 1,
    recentItemIds: [],
    packId: "stale-pack",
  }, 1, "2026-07-01T08:00:00.000Z");
  progress = beginPracticeRepair(progress, "module-01-practice", {
    repairItemIds: ["u01.be-forms.001"],
    firstPassScore: 0,
    firstPassTotal: 1,
    firstPassSkillResults: { "u01.be-forms": { score: 0, total: 1 } },
  });
  progress = beginPracticeRun(progress, "module-02-practice", {
    attempt: 1,
    recentItemIds: [],
    packId: "current-pack",
  }, 1, "2026-07-01T08:03:00.000Z");
  progress = beginPracticeRepair(progress, "module-02-practice", {
    repairItemIds: ["u02.present-simple.001"],
    firstPassScore: 0,
    firstPassTotal: 1,
    firstPassSkillResults: { "u02.present-simple": { score: 0, total: 1 } },
  });

  assert.equal(
    getActiveRepairSessionId([
      { id: "module-01-practice", revision: 2, required: true },
      { id: "module-02-practice", revision: 1, required: true },
    ], progress),
    "module-02-practice",
  );
});
