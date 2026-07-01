import type {
  LearningProgress,
  SessionRef,
  SkillProgress,
} from "./learning-progress";

export type ObjectiveInsightMeta = {
  label: string;
  unitId: string;
  itemCount: number;
};

export type ItemInsightMeta = {
  objectiveId: string;
  unitId: string;
};

export type MomentumDay = {
  key: string;
  label: string;
  minutes: number;
  active: boolean;
  isToday: boolean;
};

export type MomentumSummary = {
  days: MomentumDay[];
  activeDayCount: number;
  todayMinutes: number;
  dailyMinutes: 5 | 10 | 15;
  dailyProgress: number;
  coursePercent: number;
  completedSessions: number;
  totalSessions: number;
  strongSkills: number;
  developingSkills: number;
};

export type SkillInsight = {
  id: string;
  label: string;
  unitId?: string;
  itemCount: number;
  status: "Due" | "Developing";
  due: boolean;
  strength: number;
  sourceSessionId: string;
  lastSeenLabel: string;
};

export type MistakeGroup = {
  objectiveId: string;
  label: string;
  unitId?: string;
  count: number;
  itemIds: string[];
};

export type MistakeSummary = {
  count: number;
  groups: MistakeGroup[];
};

const clamp = (value: number, minimum = 0, maximum = 1) =>
  Math.min(maximum, Math.max(minimum, value));

const localDayKey = (isoDate: string, timeZone?: string) => {
  const date = new Date(isoDate);
  if (!Number.isFinite(date.getTime())) return "";

  const parts = new Intl.DateTimeFormat("en-GB", {
    ...(timeZone ? { timeZone } : {}),
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${values.year}-${values.month}-${values.day}`;
};

const shiftCalendarDay = (key: string, days: number) => {
  const [year, month, day] = key.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day + days, 12));
  return date.toISOString().slice(0, 10);
};

const weekdayLabel = (key: string) => new Intl.DateTimeFormat("en", {
  weekday: "narrow",
  timeZone: "UTC",
}).format(new Date(`${key}T12:00:00.000Z`));

const isCompletedForRevision = (
  progress: LearningProgress,
  session: SessionRef,
) => {
  const record = progress.sessions[session.id];
  return record?.status === "completed" &&
    (session.revision === undefined || record.revision === session.revision);
};

export const buildMomentumSummary = (
  progress: LearningProgress,
  orderedSessions: SessionRef[],
  now = new Date().toISOString(),
  timeZone?: string,
): MomentumSummary => {
  const todayKey = localDayKey(now, timeZone);
  const activityMinutes = new Map<string, number>();

  for (const activity of progress.activity) {
    const key = localDayKey(activity.at, timeZone) || activity.day;
    activityMinutes.set(key, (activityMinutes.get(key) ?? 0) + activity.minutes);
  }

  const days = Array.from({ length: 7 }, (_, index) => {
    const key = shiftCalendarDay(todayKey, index - 6);
    const minutes = activityMinutes.get(key) ?? 0;
    return {
      key,
      label: weekdayLabel(key),
      minutes,
      active: minutes > 0,
      isToday: key === todayKey,
    };
  });
  const requiredSessions = orderedSessions.filter((session) => session.required !== false);
  const completedSessions = requiredSessions.filter((session) =>
    isCompletedForRevision(progress, session)
  ).length;
  const totalSessions = requiredSessions.length;
  const todayMinutes = activityMinutes.get(todayKey) ?? 0;
  const dailyMinutes = progress.preferences.dailyMinutes;
  const skills = Object.values(progress.skills);

  return {
    days,
    activeDayCount: days.filter((day) => day.active).length,
    todayMinutes,
    dailyMinutes,
    dailyProgress: clamp(todayMinutes / dailyMinutes),
    coursePercent: totalSessions
      ? Math.round((completedSessions / totalSessions) * 100)
      : 0,
    completedSessions,
    totalSessions,
    strongSkills: skills.filter((skill) => skill.strength >= 0.8).length,
    developingSkills: skills.filter((skill) => skill.strength < 0.8).length,
  };
};

const humanizeSkillId = (skillId: string) => {
  const raw = skillId.includes(".") ? skillId.split(".").slice(1).join(" ") : skillId;
  const words = raw.replace(/[.-]+/g, " ").trim();
  return words ? words[0].toUpperCase() + words.slice(1) : "English skill";
};

export const formatLastSeen = (
  isoDate: string,
  now = new Date().toISOString(),
  timeZone?: string,
) => {
  const seenKey = localDayKey(isoDate, timeZone);
  const todayKey = localDayKey(now, timeZone);
  if (!seenKey || !todayKey) return "Recently";
  const seen = Date.parse(`${seenKey}T12:00:00.000Z`);
  const today = Date.parse(`${todayKey}T12:00:00.000Z`);
  const difference = Math.max(0, Math.round((today - seen) / 86_400_000));
  if (difference === 0) return "Today";
  if (difference === 1) return "Yesterday";
  return `${difference} days ago`;
};

const skillPriority = (
  left: [string, SkillProgress],
  right: [string, SkillProgress],
  nowMs: number,
) => {
  const leftDue = Date.parse(left[1].dueAt) <= nowMs;
  const rightDue = Date.parse(right[1].dueAt) <= nowMs;
  if (leftDue !== rightDue) return leftDue ? -1 : 1;
  if (leftDue && rightDue) {
    const dueDifference = Date.parse(left[1].dueAt) - Date.parse(right[1].dueAt);
    if (dueDifference) return dueDifference;
  }
  const strengthDifference = left[1].strength - right[1].strength;
  if (strengthDifference) return strengthDifference;
  return right[1].lapses - left[1].lapses;
};

export const buildSkillQueue = (
  progress: LearningProgress,
  objectives: Record<string, ObjectiveInsightMeta>,
  now = new Date().toISOString(),
  timeZone?: string,
  limit = 3,
): SkillInsight[] => {
  const nowMs = Date.parse(now);
  return Object.entries(progress.skills)
    .filter(([, skill]) =>
      Date.parse(skill.dueAt) <= nowMs || skill.strength < 0.8 || skill.lastGrade !== "good"
    )
    .sort((left, right) => skillPriority(left, right, nowMs))
    .slice(0, Math.max(0, limit))
    .map(([id, skill]) => {
      const objective = objectives[id];
      const due = Date.parse(skill.dueAt) <= nowMs;
      return {
        id,
        label: objective?.label ?? humanizeSkillId(id),
        ...(objective?.unitId ? { unitId: objective.unitId } : {}),
        itemCount: objective?.itemCount ?? 0,
        status: due ? "Due" : "Developing",
        due,
        strength: skill.strength,
        sourceSessionId: skill.sourceSessionId,
        lastSeenLabel: formatLastSeen(skill.lastSeenAt, now, timeZone),
      };
    });
};

export const buildMistakeSummary = (
  progress: Pick<LearningProgress, "mistakeItemIds">,
  items: Record<string, ItemInsightMeta>,
  objectives: Record<string, ObjectiveInsightMeta>,
): MistakeSummary => {
  const groups = new Map<string, MistakeGroup>();

  for (const itemId of [...new Set(progress.mistakeItemIds)]) {
    const item = items[itemId];
    const objectiveId = item?.objectiveId ?? "unknown";
    const objective = objectives[objectiveId];
    const group = groups.get(objectiveId) ?? {
      objectiveId,
      label: objective?.label ?? (objectiveId === "unknown" ? "Mixed English skills" : humanizeSkillId(objectiveId)),
      ...(item?.unitId || objective?.unitId
        ? { unitId: item?.unitId ?? objective?.unitId }
        : {}),
      count: 0,
      itemIds: [],
    };
    group.count += 1;
    group.itemIds.push(itemId);
    groups.set(objectiveId, group);
  }

  return {
    count: [...groups.values()].reduce((total, group) => total + group.count, 0),
    groups: [...groups.values()].sort((left, right) =>
      right.count - left.count || left.label.localeCompare(right.label, "en")
    ),
  };
};
