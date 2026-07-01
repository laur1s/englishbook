export const LEARNING_PROGRESS_KEY = "english-library.learning.v2";
export const LEGACY_LEARNING_PROGRESS_KEY = "english-library.learning.v1";
export const LEARNING_PROGRESS_VERSION = 2;

export type StorageLike = Pick<Storage, "getItem" | "setItem">;

export type PracticeRunProgress = {
  attempt: number;
  recentItemIds: string[];
  priorityItemIds: string[];
  targetObjectiveIds: string[];
  packId: string;
  itemRefs: Array<{ id: string; revision: number }>;
  phase: "practice" | "repair";
  repairItemIds: string[];
  firstPassScore?: number;
  firstPassTotal?: number;
  firstPassSkillResults?: Record<string, { score: number; total: number }>;
  startedAt: string;
};

export type SessionProgress = {
  revision: number;
  status: "started" | "completed";
  currentItemId?: string;
  responses: Record<string, string>;
  attempts: number;
  score?: number;
  total?: number;
  startedAt: string;
  updatedAt: string;
  completedAt?: string;
  practiceRun?: PracticeRunProgress;
};

export type SkillProgress = {
  strength: number;
  stage: number;
  intervalDays: number;
  lastSeenAt: string;
  dueAt: string;
  lapses: number;
  successfulReviews: number;
  lastGrade: "again" | "hard" | "good";
  sourceSessionId: string;
};

export type LearningActivity = {
  id: string;
  at: string;
  day: string;
  sessionId: string;
  type: "content" | "practice" | "speaking";
  minutes: number;
};

export type LearningPreferences = {
  dailyMinutes: 5 | 10 | 15;
};

export type LearningProgress = {
  version: 2;
  activeSessionId: string | null;
  sessions: Record<string, SessionProgress>;
  skills: Record<string, SkillProgress>;
  practiceAttempts: Record<string, number>;
  recentItemIds: string[];
  mistakeItemIds: string[];
  activeDays: string[];
  activity: LearningActivity[];
  preferences: LearningPreferences;
};

export type SessionRef = { id: string; revision?: number; required?: boolean };

export type LegacyProgressMapping = {
  unitSlug: string;
  learnSessionId: string;
  missionSlug: string;
  speakSessionId: string;
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  Boolean(value) && typeof value === "object" && !Array.isArray(value);

const clamp = (value: number, minimum = 0, maximum = 1) =>
  Math.min(maximum, Math.max(minimum, value));

const addDays = (isoDate: string, days: number) => {
  const date = new Date(isoDate);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString();
};

const REVIEW_INTERVALS = [1, 3, 7, 14, 30, 60] as const;

export const localDayKey = (isoDate: string, timeZone?: string) => {
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

const isTimestamp = (value: unknown): value is string =>
  typeof value === "string" && Number.isFinite(Date.parse(value));

const normalizeTimestamp = (value: unknown) =>
  isTimestamp(value) ? new Date(value).toISOString() : undefined;

const uniqueStrings = (value: unknown, limit = 40) => Array.isArray(value)
  ? [...new Set(value.filter((item): item is string => typeof item === "string" && Boolean(item)))]
      .slice(-limit)
  : [];

const sanitizeSkillResults = (value: unknown) => {
  if (!isRecord(value)) return undefined;
  const entries = Object.entries(value).flatMap(([id, result]) => {
    if (!isRecord(result)) return [];
    if (!Number.isInteger(result.score) || Number(result.score) < 0) return [];
    if (!Number.isInteger(result.total) || Number(result.total) <= 0) return [];
    return [[id, { score: Number(result.score), total: Number(result.total) }] as const];
  });
  return entries.length ? Object.fromEntries(entries) : undefined;
};

const stringRecord = (value: unknown) => {
  if (!isRecord(value)) return {};
  return Object.fromEntries(
    Object.entries(value).filter((entry): entry is [string, string] => typeof entry[1] === "string"),
  );
};

const sanitizePracticeRun = (value: unknown): PracticeRunProgress | undefined => {
  if (!isRecord(value)) return undefined;
  if (!Number.isInteger(value.attempt) || Number(value.attempt) <= 0) return undefined;
  if (typeof value.packId !== "string" || !value.packId) return undefined;
  const startedAt = normalizeTimestamp(value.startedAt);
  if (!startedAt) return undefined;
  const firstPassScore = Number.isInteger(value.firstPassScore) && Number(value.firstPassScore) >= 0
    ? Number(value.firstPassScore)
    : undefined;
  const firstPassTotal = Number.isInteger(value.firstPassTotal) && Number(value.firstPassTotal) > 0
    ? Number(value.firstPassTotal)
    : undefined;
  const firstPassSkillResults = sanitizeSkillResults(value.firstPassSkillResults);

  return {
    attempt: Number(value.attempt),
    packId: value.packId,
    startedAt,
    phase: value.phase === "repair" ? "repair" : "practice",
    repairItemIds: uniqueStrings(value.repairItemIds),
    priorityItemIds: uniqueStrings(value.priorityItemIds),
    targetObjectiveIds: uniqueStrings(value.targetObjectiveIds),
    ...(firstPassScore !== undefined ? { firstPassScore } : {}),
    ...(firstPassTotal !== undefined ? { firstPassTotal } : {}),
    ...(firstPassSkillResults ? { firstPassSkillResults } : {}),
    itemRefs: Array.isArray(value.itemRefs)
      ? value.itemRefs.flatMap((item) =>
          isRecord(item) &&
          typeof item.id === "string" &&
          item.id &&
          Number.isInteger(item.revision) &&
          Number(item.revision) > 0
            ? [{ id: item.id, revision: Number(item.revision) }]
            : [],
        ).slice(0, 40)
      : [],
    recentItemIds: uniqueStrings(value.recentItemIds),
  };
};

const sanitizeSessions = (value: unknown): Record<string, SessionProgress> => {
  if (!isRecord(value)) return {};
  const sessions: Record<string, SessionProgress> = {};

  for (const [id, raw] of Object.entries(value)) {
    if (!isRecord(raw)) continue;
    if (!Number.isInteger(raw.revision) || Number(raw.revision) <= 0) continue;
    if (raw.status !== "started" && raw.status !== "completed") continue;
    if (!Number.isInteger(raw.attempts) || Number(raw.attempts) < 0) continue;
    const startedAt = normalizeTimestamp(raw.startedAt);
    const updatedAt = normalizeTimestamp(raw.updatedAt);
    if (!startedAt || !updatedAt) continue;

    const score = typeof raw.score === "number" && Number.isFinite(raw.score)
      ? Math.max(0, raw.score)
      : undefined;
    const total = typeof raw.total === "number" && Number.isFinite(raw.total)
      ? Math.max(0, raw.total)
      : undefined;
    const completedAt = normalizeTimestamp(raw.completedAt);
    const practiceRun = sanitizePracticeRun(raw.practiceRun);

    sessions[id] = {
      revision: Number(raw.revision),
      status: raw.status,
      responses: stringRecord(raw.responses),
      attempts: Number(raw.attempts),
      startedAt,
      updatedAt,
      ...(typeof raw.currentItemId === "string" ? { currentItemId: raw.currentItemId } : {}),
      ...(score !== undefined ? { score } : {}),
      ...(total !== undefined ? { total } : {}),
      ...(completedAt ? { completedAt } : {}),
      ...(practiceRun ? { practiceRun } : {}),
    };
  }

  return sessions;
};

const sanitizeSkills = (value: unknown): Record<string, SkillProgress> => {
  if (!isRecord(value)) return {};
  const skills: Record<string, SkillProgress> = {};

  for (const [id, raw] of Object.entries(value)) {
    if (!isRecord(raw)) continue;
    if (typeof raw.strength !== "number" || !Number.isFinite(raw.strength)) continue;
    if (!Number.isInteger(raw.intervalDays) || Number(raw.intervalDays) <= 0) continue;
    if (!Number.isInteger(raw.lapses) || Number(raw.lapses) < 0) continue;
    const lastSeenAt = normalizeTimestamp(raw.lastSeenAt);
    const dueAt = normalizeTimestamp(raw.dueAt);
    if (!lastSeenAt || !dueAt) continue;
    if (typeof raw.sourceSessionId !== "string" || !raw.sourceSessionId) continue;
    const intervalDays = Number(raw.intervalDays);
    const inferredStage = REVIEW_INTERVALS.reduce(
      (best, interval, index) => intervalDays >= interval ? index : best,
      0,
    );
    const stage = Number.isInteger(raw.stage)
      ? Math.min(REVIEW_INTERVALS.length - 1, Math.max(0, Number(raw.stage)))
      : inferredStage;
    const lastGrade = raw.lastGrade === "again" || raw.lastGrade === "hard" || raw.lastGrade === "good"
      ? raw.lastGrade
      : raw.strength < 0.6
        ? "again"
        : raw.strength < 0.8
          ? "hard"
          : "good";

    skills[id] = {
      strength: clamp(raw.strength),
      stage,
      intervalDays,
      lastSeenAt,
      dueAt,
      lapses: Number(raw.lapses),
      successfulReviews: Number.isInteger(raw.successfulReviews) && Number(raw.successfulReviews) >= 0
        ? Number(raw.successfulReviews)
        : 0,
      lastGrade,
      sourceSessionId: raw.sourceSessionId,
    };
  }

  return skills;
};

const sanitizeAttemptCounts = (value: unknown) => {
  if (!isRecord(value)) return {};
  return Object.fromEntries(
    Object.entries(value).filter(
      (entry): entry is [string, number] => Number.isInteger(entry[1]) && Number(entry[1]) >= 0,
    ),
  );
};

const sanitizeActivity = (value: unknown): LearningActivity[] => {
  if (!Array.isArray(value)) return [];
  return value.flatMap<LearningActivity>((raw) => {
    if (!isRecord(raw)) return [];
    const at = normalizeTimestamp(raw.at);
    if (!at || typeof raw.sessionId !== "string" || !raw.sessionId) return [];
    if (raw.type !== "content" && raw.type !== "practice" && raw.type !== "speaking") return [];
    if (!Number.isInteger(raw.minutes) || Number(raw.minutes) <= 0 || Number(raw.minutes) > 180) return [];
    const day = typeof raw.day === "string" && /^\d{4}-\d{2}-\d{2}$/.test(raw.day)
      ? raw.day
      : localDayKey(at);
    const id = typeof raw.id === "string" && raw.id
      ? raw.id
      : `${raw.sessionId}:${at}`;
    return [{
      id,
      at,
      day,
      sessionId: raw.sessionId,
      type: raw.type,
      minutes: Number(raw.minutes),
    }];
  }).slice(-365);
};

const sanitizePreferences = (value: unknown): LearningPreferences => ({
  dailyMinutes: isRecord(value) && (value.dailyMinutes === 5 || value.dailyMinutes === 10 || value.dailyMinutes === 15)
    ? value.dailyMinutes
    : 10,
});

export const createLearningProgress = (): LearningProgress => ({
  version: LEARNING_PROGRESS_VERSION,
  activeSessionId: null,
  sessions: {},
  skills: {},
  practiceAttempts: {},
  recentItemIds: [],
  mistakeItemIds: [],
  activeDays: [],
  activity: [],
  preferences: { dailyMinutes: 10 },
});

export const parseLearningProgress = (value: string | null): LearningProgress => {
  if (!value) {
    return createLearningProgress();
  }

  try {
    const parsed = JSON.parse(value);

    if (!isRecord(parsed) || (parsed.version !== 1 && parsed.version !== LEARNING_PROGRESS_VERSION)) {
      return createLearningProgress();
    }

    const sessions = sanitizeSessions(parsed.sessions);
    const activeSessionId = typeof parsed.activeSessionId === "string" &&
      Object.prototype.hasOwnProperty.call(sessions, parsed.activeSessionId)
      ? parsed.activeSessionId
      : null;

    return {
      version: LEARNING_PROGRESS_VERSION,
      activeSessionId,
      sessions,
      skills: sanitizeSkills(parsed.skills),
      practiceAttempts: sanitizeAttemptCounts(parsed.practiceAttempts),
      recentItemIds: Array.isArray(parsed.recentItemIds)
        ? parsed.recentItemIds.filter((item): item is string => typeof item === "string").slice(-40)
        : [],
      mistakeItemIds: uniqueStrings(parsed.mistakeItemIds),
      activeDays: Array.isArray(parsed.activeDays)
        ? parsed.activeDays.filter(
            (item): item is string => typeof item === "string" && /^\d{4}-\d{2}-\d{2}$/.test(item),
          ).slice(-90)
        : [],
      activity: sanitizeActivity(parsed.activity),
      preferences: sanitizePreferences(parsed.preferences),
    };
  } catch {
    return createLearningProgress();
  }
};

export const readLearningProgress = (storage: StorageLike): LearningProgress => {
  try {
    return parseLearningProgress(
      storage.getItem(LEARNING_PROGRESS_KEY) ?? storage.getItem(LEGACY_LEARNING_PROGRESS_KEY),
    );
  } catch {
    return createLearningProgress();
  }
};

export const writeLearningProgress = (storage: StorageLike, progress: LearningProgress) => {
  try {
    storage.setItem(LEARNING_PROGRESS_KEY, JSON.stringify(progress));
    return true;
  } catch {
    return false;
  }
};

const readLegacyRecord = (storage: StorageLike, key: string) => {
  try {
    const raw = storage.getItem(key);
    const parsed = raw ? JSON.parse(raw) : {};
    return isRecord(parsed) ? parsed : {};
  } catch {
    return {};
  }
};

export const migrateLegacyLearningProgress = (
  storage: StorageLike,
  mappings: LegacyProgressMapping[],
  now = new Date().toISOString(),
) => {
  const lessonProgress = readLegacyRecord(storage, "english-library.lesson-progress");
  const speakingProgress = readLegacyRecord(storage, "english-library.speaking.progress");
  let progress = readLearningProgress(storage);
  let changed = false;

  for (const mapping of mappings) {
    const lessonRecord = lessonProgress[mapping.unitSlug];
    const speakingRecord = speakingProgress[mapping.missionSlug];

    if (
      isRecord(lessonRecord) &&
      typeof lessonRecord.completedAt === "string" &&
      progress.sessions[mapping.learnSessionId]?.status !== "completed"
    ) {
      progress = completeLearningSession(progress, mapping.learnSessionId, {}, lessonRecord.completedAt || now);
      changed = true;
    }

    if (
      isRecord(speakingRecord) &&
      speakingRecord.completed === true &&
      progress.sessions[mapping.speakSessionId]?.status !== "completed"
    ) {
      const completedAt = typeof speakingRecord.completedAt === "string"
        ? speakingRecord.completedAt
        : now;
      progress = completeLearningSession(progress, mapping.speakSessionId, {}, completedAt);
      changed = true;
    }
  }

  if (changed) {
    writeLearningProgress(storage, progress);
  }

  return progress;
};

const withLearningActivity = (
  progress: LearningProgress,
  sessionId: string,
  type: LearningActivity["type"],
  minutes: number,
  now: string,
): LearningProgress => {
  const day = localDayKey(now);
  if (!day || !Number.isInteger(minutes) || minutes <= 0) return progress;
  const activity: LearningActivity = {
    id: `${sessionId}:${now}`,
    at: now,
    day,
    sessionId,
    type,
    minutes,
  };
  return {
    ...progress,
    activeDays: [...new Set([...progress.activeDays, day])].slice(-90),
    activity: [...progress.activity, activity].slice(-365),
  };
};

export const startLearningSession = (
  progress: LearningProgress,
  sessionId: string,
  revision = 1,
  now = new Date().toISOString(),
): LearningProgress => {
  const existing = progress.sessions[sessionId];
  const session: SessionProgress = existing?.revision === revision
    ? { ...existing, status: existing.status, updatedAt: now }
    : {
        revision,
        status: "started",
        responses: {},
        attempts: 0,
        startedAt: now,
        updatedAt: now,
      };

  const activeProgress = progress.activeSessionId
    ? progress.sessions[progress.activeSessionId]
    : undefined;
  const shouldBecomeActive =
    !progress.activeSessionId ||
    progress.activeSessionId === sessionId ||
    !activeProgress ||
    activeProgress.status === "completed";

  return {
    ...progress,
    activeSessionId: shouldBecomeActive ? sessionId : progress.activeSessionId,
    sessions: { ...progress.sessions, [sessionId]: session },
  };
};

export const beginPracticeRun = (
  progress: LearningProgress,
  sessionId: string,
  run: Pick<PracticeRunProgress, "attempt" | "recentItemIds" | "packId"> & {
    itemRefs?: PracticeRunProgress["itemRefs"];
    priorityItemIds?: string[];
    targetObjectiveIds?: string[];
    phase?: PracticeRunProgress["phase"];
    repairItemIds?: string[];
    firstPassScore?: number;
    firstPassTotal?: number;
    firstPassSkillResults?: Record<string, { score: number; total: number }>;
    startedAt?: string;
  },
  revision = 1,
  now = new Date().toISOString(),
): LearningProgress => {
  const started = startLearningSession(progress, sessionId, revision, now);
  const existing = started.sessions[sessionId];

  return {
    ...started,
    sessions: {
      ...started.sessions,
      [sessionId]: {
        ...existing,
        responses: {},
        currentItemId: undefined,
        updatedAt: now,
        practiceRun: {
          attempt: run.attempt,
          recentItemIds: [...run.recentItemIds].slice(-40),
          priorityItemIds: [...new Set(run.priorityItemIds ?? [])].slice(-40),
          targetObjectiveIds: [...new Set(run.targetObjectiveIds ?? [])].slice(-40),
          packId: run.packId,
          itemRefs: (run.itemRefs ?? []).map((item) => ({ ...item })).slice(0, 40),
          phase: run.phase ?? "practice",
          repairItemIds: [...new Set(run.repairItemIds ?? [])].slice(-40),
          ...(run.firstPassScore !== undefined ? { firstPassScore: run.firstPassScore } : {}),
          ...(run.firstPassTotal !== undefined ? { firstPassTotal: run.firstPassTotal } : {}),
          ...(run.firstPassSkillResults
            ? { firstPassSkillResults: structuredClone(run.firstPassSkillResults) }
            : {}),
          startedAt: run.startedAt ?? now,
        },
      },
    },
  };
};

export const beginPracticeRepair = (
  progress: LearningProgress,
  sessionId: string,
  repair: {
    repairItemIds: string[];
    firstPassScore: number;
    firstPassTotal: number;
    firstPassSkillResults: Record<string, { score: number; total: number }>;
  },
  now = new Date().toISOString(),
): LearningProgress => {
  const existing = progress.sessions[sessionId];
  if (!existing?.practiceRun) return progress;

  return {
    ...progress,
    mistakeItemIds: [...new Set([
      ...progress.mistakeItemIds,
      ...repair.repairItemIds,
    ])].slice(-40),
    sessions: {
      ...progress.sessions,
      [sessionId]: {
        ...existing,
        responses: {},
        currentItemId: undefined,
        updatedAt: now,
        practiceRun: {
          ...existing.practiceRun,
          phase: "repair",
          repairItemIds: [...new Set(repair.repairItemIds)].slice(-40),
          firstPassScore: Math.max(0, repair.firstPassScore),
          firstPassTotal: Math.max(1, repair.firstPassTotal),
          firstPassSkillResults: structuredClone(repair.firstPassSkillResults),
        },
      },
    },
  };
};

export const saveLearningResponse = (
  progress: LearningProgress,
  sessionId: string,
  itemId: string,
  response: string,
  now = new Date().toISOString(),
): LearningProgress => {
  const revision = progress.sessions[sessionId]?.revision ?? 1;
  const started = startLearningSession(progress, sessionId, revision, now);
  const session = started.sessions[sessionId];

  return {
    ...started,
    sessions: {
      ...started.sessions,
      [sessionId]: {
        ...session,
        currentItemId: itemId,
        responses: { ...session.responses, [itemId]: response },
        updatedAt: now,
      },
    },
  };
};

const gradeAccuracy = (accuracy: number): SkillProgress["lastGrade"] =>
  accuracy < 0.6 ? "again" : accuracy < 0.8 ? "hard" : "good";

const nextSkillSchedule = (
  previous: SkillProgress | undefined,
  accuracy: number,
  now: string,
) => {
  const grade = gradeAccuracy(accuracy);
  if (!previous) {
    const stage = grade === "again" ? 0 : grade === "hard" ? 1 : 2;
    return { stage, intervalDays: REVIEW_INTERVALS[stage], grade, successfulReview: false };
  }

  const dueNow = Date.parse(previous.dueAt) <= Date.parse(now);
  const stage = grade === "again"
    ? 0
    : grade === "hard"
      ? Math.max(1, previous.stage)
      : dueNow
        ? Math.min(REVIEW_INTERVALS.length - 1, previous.stage + 1)
        : previous.stage;
  return {
    stage,
    intervalDays: REVIEW_INTERVALS[stage],
    grade,
    successfulReview: grade === "good" && dueNow,
  };
};

export const completeLearningSession = (
  progress: LearningProgress,
  sessionId: string,
  options: {
    revision?: number;
    score?: number;
    total?: number;
    skillRefs?: string[];
    itemIds?: string[];
    nextSessionId?: string | null;
    skillResults?: Record<string, { score: number; total: number }>;
    minutes?: number;
    activityType?: LearningActivity["type"];
    mistakeItemIds?: string[];
  } = {},
  now = new Date().toISOString(),
): LearningProgress => {
  const started = startLearningSession(progress, sessionId, options.revision ?? 1, now);
  const existing = started.sessions[sessionId];
  const score = Number.isFinite(options.score) ? Math.max(0, Number(options.score)) : undefined;
  const total = Number.isFinite(options.total) ? Math.max(0, Number(options.total)) : undefined;
  const accuracy = total && score !== undefined ? clamp(score / total) : 1;
  const skills = { ...started.skills };

  for (const skillId of options.skillRefs ?? []) {
    const previous = skills[skillId];
    const skillResult = options.skillResults?.[skillId];
    const skillAccuracy = skillResult && skillResult.total > 0
      ? clamp(skillResult.score / skillResult.total)
      : accuracy;
    const schedule = nextSkillSchedule(previous, skillAccuracy, now);
    skills[skillId] = {
      strength: clamp(
        previous ? previous.strength * 0.55 + skillAccuracy * 0.45 : skillAccuracy,
      ),
      stage: schedule.stage,
      intervalDays: schedule.intervalDays,
      lastSeenAt: now,
      dueAt: addDays(now, schedule.intervalDays),
      lapses: (previous?.lapses ?? 0) + (skillAccuracy < 0.6 ? 1 : 0),
      successfulReviews: (previous?.successfulReviews ?? 0) + (schedule.successfulReview ? 1 : 0),
      lastGrade: schedule.grade,
      sourceSessionId: sessionId,
    };
  }

  const hasNextSession = Object.prototype.hasOwnProperty.call(options, "nextSessionId");

  const successfulItemIds = new Set(options.itemIds ?? []);
  const mistakeItemIds = new Set(started.mistakeItemIds);
  successfulItemIds.forEach((itemId) => mistakeItemIds.delete(itemId));
  (options.mistakeItemIds ?? []).forEach((itemId) => mistakeItemIds.add(itemId));

  const completed: LearningProgress = {
    ...started,
    activeSessionId: hasNextSession ? options.nextSessionId ?? null : started.activeSessionId,
    sessions: {
      ...started.sessions,
      [sessionId]: {
        ...existing,
        status: "completed",
        attempts: existing.attempts + 1,
        score,
        total,
        updatedAt: now,
        completedAt: now,
        currentItemId: undefined,
        practiceRun: undefined,
      },
    },
    skills,
    recentItemIds: [...new Set([...started.recentItemIds, ...(options.itemIds ?? [])])].slice(-40),
    mistakeItemIds: [...mistakeItemIds].slice(-40),
  };

  return options.minutes
    ? withLearningActivity(
        completed,
        sessionId,
        options.activityType ?? (total ? "practice" : "content"),
        options.minutes,
        now,
      )
    : completed;
};

export const nextPracticeAttempt = (
  progress: LearningProgress,
  sessionId: string,
): LearningProgress => ({
  ...progress,
  practiceAttempts: {
    ...progress.practiceAttempts,
    [sessionId]: (Number.isInteger(progress.practiceAttempts[sessionId])
      ? progress.practiceAttempts[sessionId]
      : 0) + 1,
  },
});

export const setDailyMinutes = (
  progress: LearningProgress,
  dailyMinutes: LearningPreferences["dailyMinutes"],
): LearningProgress => ({
  ...progress,
  preferences: { ...progress.preferences, dailyMinutes },
});

const isCompletedForRevision = (
  session: SessionRef,
  progress: LearningProgress,
) => {
  const record = progress.sessions[session.id];
  return record?.status === "completed" &&
    (session.revision === undefined || record.revision === session.revision);
};

export const isLearningSessionUnlocked = (
  orderedSessions: SessionRef[],
  progress: LearningProgress,
  sessionId: string,
) => {
  const targetIndex = orderedSessions.findIndex((session) => session.id === sessionId);
  if (targetIndex < 0) return false;

  return orderedSessions.slice(0, targetIndex).every(
    (session) => session.required === false || isCompletedForRevision(session, progress),
  );
};

export const getNextLearningSessionId = (
  orderedSessions: SessionRef[],
  progress: LearningProgress,
) => {
  const requiredSessions = orderedSessions.filter((session) => session.required !== false);
  return requiredSessions.find((session) => !isCompletedForRevision(session, progress))?.id
    ?? requiredSessions.at(-1)?.id
    ?? null;
};

export const getDueSkills = (
  progress: LearningProgress,
  now = new Date().toISOString(),
) => Object.entries(progress.skills)
  .filter(([, skill]) => Date.parse(skill.dueAt) <= Date.parse(now))
  .sort((left, right) => {
    const overdueDifference = Date.parse(left[1].dueAt) - Date.parse(right[1].dueAt);
    if (overdueDifference !== 0) return overdueDifference;
    const strengthDifference = left[1].strength - right[1].strength;
    if (strengthDifference !== 0) return strengthDifference;
    return right[1].lapses - left[1].lapses;
  });

export const getWeakSkills = (progress: LearningProgress) => Object.entries(progress.skills)
  .filter(([, skill]) => skill.strength < 0.8)
  .sort((left, right) => {
    const strengthDifference = left[1].strength - right[1].strength;
    return strengthDifference || right[1].lapses - left[1].lapses;
  });

export const getCompletedSessionCount = (progress: LearningProgress) =>
  Object.values(progress.sessions).filter((session) => session.status === "completed").length;
