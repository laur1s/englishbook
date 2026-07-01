import type {
  LearningPreferences,
  LearningProgress,
  SkillProgress,
} from "./learning-progress";
import type { PracticeCatalog } from "./practice/schema";

export const DAILY_RECALL_MAX_ITEMS = 8;
export const DAILY_RECALL_SESSION_ID = "daily-recall";
export const DAILY_RECALL_REVISION = 1;

export type DailyRecallEmptyReason =
  | "nothing-due"
  | "no-matching-catalog-content";

export type DailyRecallProgress = Pick<
  LearningProgress,
  "mistakeItemIds" | "skills" | "preferences"
>;

type DailyRecallPlanBase = {
  mode: "review";
  targetObjectiveIds: string[];
  priorityItemIds: string[];
};

export type ReadyDailyRecallPlan = DailyRecallPlanBase & {
  unitIds: [string, ...string[]];
  count: number;
  minutes: number;
  emptyReason: null;
};

export type EmptyDailyRecallPlan = DailyRecallPlanBase & {
  unitIds: [];
  count: 0;
  minutes: 0;
  emptyReason: DailyRecallEmptyReason;
};

export type DailyRecallPlan = ReadyDailyRecallPlan | EmptyDailyRecallPlan;

type CatalogItemMeta = {
  id: string;
  objectiveId: string;
  unitId: string;
};

type CatalogObjectiveMeta = {
  id: string;
  unitId: string;
};

type RankedSkill = {
  id: string;
  skill: SkillProgress;
  objective: CatalogObjectiveMeta;
  due: boolean;
  dueAt: number;
};

const compareIds = (left: string, right: string) =>
  left.localeCompare(right, "en");

const validTimestamp = (value: string) => {
  const timestamp = Date.parse(value);
  return Number.isFinite(timestamp) ? timestamp : Number.POSITIVE_INFINITY;
};

const needsRecall = (skill: SkillProgress, nowMs: number) =>
  validTimestamp(skill.dueAt) <= nowMs ||
  skill.strength < 0.8 ||
  skill.lastGrade !== "good";

const rankSkills = (left: RankedSkill, right: RankedSkill) => {
  if (left.due !== right.due) return left.due ? -1 : 1;
  if (left.due && left.dueAt !== right.dueAt) {
    return left.dueAt - right.dueAt;
  }

  const strengthDifference = left.skill.strength - right.skill.strength;
  if (strengthDifference) return strengthDifference;

  const lapseDifference = right.skill.lapses - left.skill.lapses;
  if (lapseDifference) return lapseDifference;

  return compareIds(left.id, right.id);
};

const uniqueInOrder = (values: readonly string[]) => {
  const seen = new Set<string>();
  return values.filter((value) => {
    if (seen.has(value)) return false;
    seen.add(value);
    return true;
  });
};

const itemBudget = (dailyMinutes: LearningPreferences["dailyMinutes"]) =>
  Math.min(
    DAILY_RECALL_MAX_ITEMS,
    Math.max(1, Math.floor(dailyMinutes / 1.25)),
  );

const estimatedMinutes = (
  count: number,
  dailyMinutes: LearningPreferences["dailyMinutes"],
) => Math.min(dailyMinutes, Math.max(1, Math.ceil(count * 1.25)));

/**
 * Plans a short cross-unit review without reading or changing linear course state.
 * The non-empty result can be passed directly to the practice pack generator.
 */
export const buildDailyRecallPlan = (
  catalog: PracticeCatalog,
  progress: DailyRecallProgress,
  now = new Date().toISOString(),
): DailyRecallPlan => {
  const nowMs = Date.parse(now);

  if (!Number.isFinite(nowMs)) {
    throw new RangeError("Daily recall now must be a valid timestamp");
  }

  const itemById = new Map<string, CatalogItemMeta>();
  const objectiveById = new Map<string, CatalogObjectiveMeta>();
  const itemCountByUnit = new Map<string, number>();

  for (const unit of [...catalog.units].sort((left, right) =>
    compareIds(left.unitId, right.unitId)
  )) {
    const items = [...unit.items].sort((left, right) => compareIds(left.id, right.id));
    itemCountByUnit.set(unit.unitId, items.length);

    for (const item of items) {
      if (!itemById.has(item.id)) {
        itemById.set(item.id, {
          id: item.id,
          objectiveId: item.objectiveId,
          unitId: unit.unitId,
        });
      }

      if (!objectiveById.has(item.objectiveId)) {
        objectiveById.set(item.objectiveId, {
          id: item.objectiveId,
          unitId: unit.unitId,
        });
      }
    }
  }

  const priorityItems = uniqueInOrder(progress.mistakeItemIds)
    .map((itemId) => itemById.get(itemId))
    .filter((item): item is CatalogItemMeta => Boolean(item))
    .sort((left, right) => compareIds(left.id, right.id));

  const rankedSkills = Object.entries(progress.skills)
    .filter(([, skill]) => needsRecall(skill, nowMs))
    .flatMap(([id, skill]): RankedSkill[] => {
      const objective = objectiveById.get(id);
      if (!objective) return [];

      const dueAt = validTimestamp(skill.dueAt);
      return [{
        id,
        skill,
        objective,
        due: dueAt <= nowMs,
        dueAt,
      }];
    })
    .sort(rankSkills);

  const targetObjectiveIds = uniqueInOrder([
    ...priorityItems.map((item) => item.objectiveId),
    ...rankedSkills.map((entry) => entry.id),
  ]);
  const representedUnitIds = new Set([
    ...priorityItems.map((item) => item.unitId),
    ...rankedSkills.map((entry) => entry.objective.unitId),
  ]);
  const unitIds = [...representedUnitIds].sort(compareIds);

  if (unitIds.length === 0) {
    const hasReviewSignal =
      progress.mistakeItemIds.length > 0 ||
      Object.values(progress.skills).some((skill) => needsRecall(skill, nowMs));

    return {
      mode: "review",
      unitIds: [],
      targetObjectiveIds: [],
      priorityItemIds: [],
      count: 0,
      minutes: 0,
      emptyReason: hasReviewSignal
        ? "no-matching-catalog-content"
        : "nothing-due",
    };
  }

  const availableItemCount = unitIds.reduce(
    (total, unitId) => total + (itemCountByUnit.get(unitId) ?? 0),
    0,
  );
  const count = Math.min(
    availableItemCount,
    itemBudget(progress.preferences.dailyMinutes),
  );

  if (count === 0) {
    return {
      mode: "review",
      unitIds: [],
      targetObjectiveIds: [],
      priorityItemIds: [],
      count: 0,
      minutes: 0,
      emptyReason: "no-matching-catalog-content",
    };
  }

  return {
    mode: "review",
    unitIds: unitIds as [string, ...string[]],
    targetObjectiveIds,
    priorityItemIds: priorityItems.map((item) => item.id),
    count,
    minutes: estimatedMinutes(count, progress.preferences.dailyMinutes),
    emptyReason: null,
  };
};
