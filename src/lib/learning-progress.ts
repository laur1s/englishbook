export const LEARNING_PROGRESS_KEY = "english-library.learning.v1";
export const LEARNING_PROGRESS_VERSION = 1;

export type StorageLike = Pick<Storage, "getItem" | "setItem">;

export type PracticeRunProgress = {
  attempt: number;
  recentItemIds: string[];
  packId: string;
  itemRefs: Array<{ id: string; revision: number }>;
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
  intervalDays: number;
  lastSeenAt: string;
  dueAt: string;
  lapses: number;
  sourceSessionId: string;
};

export type LearningProgress = {
  version: 1;
  activeSessionId: string | null;
  sessions: Record<string, SessionProgress>;
  skills: Record<string, SkillProgress>;
  practiceAttempts: Record<string, number>;
  recentItemIds: string[];
  activeDays: string[];
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

const dayKey = (isoDate: string) => isoDate.slice(0, 10);

const isTimestamp = (value: unknown): value is string =>
  typeof value === "string" && Number.isFinite(Date.parse(value));

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
  if (!isTimestamp(value.startedAt)) return undefined;

  return {
    attempt: Number(value.attempt),
    packId: value.packId,
    startedAt: value.startedAt,
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
    recentItemIds: Array.isArray(value.recentItemIds)
      ? value.recentItemIds.filter((item): item is string => typeof item === "string").slice(-40)
      : [],
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
    if (!isTimestamp(raw.startedAt) || !isTimestamp(raw.updatedAt)) continue;

    const score = typeof raw.score === "number" && Number.isFinite(raw.score)
      ? Math.max(0, raw.score)
      : undefined;
    const total = typeof raw.total === "number" && Number.isFinite(raw.total)
      ? Math.max(0, raw.total)
      : undefined;
    const completedAt = isTimestamp(raw.completedAt) ? raw.completedAt : undefined;
    const practiceRun = sanitizePracticeRun(raw.practiceRun);

    sessions[id] = {
      revision: Number(raw.revision),
      status: raw.status,
      responses: stringRecord(raw.responses),
      attempts: Number(raw.attempts),
      startedAt: raw.startedAt,
      updatedAt: raw.updatedAt,
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
    if (!isTimestamp(raw.lastSeenAt) || !isTimestamp(raw.dueAt)) continue;
    if (typeof raw.sourceSessionId !== "string" || !raw.sourceSessionId) continue;

    skills[id] = {
      strength: clamp(raw.strength),
      intervalDays: Number(raw.intervalDays),
      lastSeenAt: raw.lastSeenAt,
      dueAt: raw.dueAt,
      lapses: Number(raw.lapses),
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

export const createLearningProgress = (): LearningProgress => ({
  version: LEARNING_PROGRESS_VERSION,
  activeSessionId: null,
  sessions: {},
  skills: {},
  practiceAttempts: {},
  recentItemIds: [],
  activeDays: [],
});

export const parseLearningProgress = (value: string | null): LearningProgress => {
  if (!value) {
    return createLearningProgress();
  }

  try {
    const parsed = JSON.parse(value);

    if (!isRecord(parsed) || parsed.version !== LEARNING_PROGRESS_VERSION) {
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
      activeDays: Array.isArray(parsed.activeDays)
        ? parsed.activeDays.filter(
            (item): item is string => typeof item === "string" && /^\d{4}-\d{2}-\d{2}$/.test(item),
          ).slice(-90)
        : [],
    };
  } catch {
    return createLearningProgress();
  }
};

export const readLearningProgress = (storage: StorageLike): LearningProgress => {
  try {
    return parseLearningProgress(storage.getItem(LEARNING_PROGRESS_KEY));
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

const withActiveDay = (progress: LearningProgress, now: string): LearningProgress => {
  const activeDays = [...new Set([...progress.activeDays, dayKey(now)])].slice(-90);
  return { ...progress, activeDays };
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

  return withActiveDay({
    ...progress,
    activeSessionId: shouldBecomeActive ? sessionId : progress.activeSessionId,
    sessions: { ...progress.sessions, [sessionId]: session },
  }, now);
};

export const beginPracticeRun = (
  progress: LearningProgress,
  sessionId: string,
  run: Omit<PracticeRunProgress, "startedAt" | "itemRefs"> & {
    itemRefs?: PracticeRunProgress["itemRefs"];
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
          packId: run.packId,
          itemRefs: (run.itemRefs ?? []).map((item) => ({ ...item })).slice(0, 40),
          startedAt: run.startedAt ?? now,
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

const nextInterval = (previous: SkillProgress | undefined, accuracy: number) => {
  if (accuracy < 0.6) return 1;
  if (accuracy < 0.8) return 3;
  return Math.min(previous ? Math.max(7, previous.intervalDays * 2) : 7, 30);
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
    const intervalDays = nextInterval(previous, skillAccuracy);
    skills[skillId] = {
      strength: clamp(
        previous ? previous.strength * 0.55 + skillAccuracy * 0.45 : skillAccuracy,
      ),
      intervalDays,
      lastSeenAt: now,
      dueAt: addDays(now, intervalDays),
      lapses: (previous?.lapses ?? 0) + (skillAccuracy < 0.6 ? 1 : 0),
      sourceSessionId: sessionId,
    };
  }

  const hasNextSession = Object.prototype.hasOwnProperty.call(options, "nextSessionId");

  return withActiveDay({
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
  }, now);
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
  .filter(([, skill]) => skill.dueAt <= now)
  .sort((left, right) => left[1].dueAt.localeCompare(right[1].dueAt));

export const getCompletedSessionCount = (progress: LearningProgress) =>
  Object.values(progress.sessions).filter((session) => session.status === "completed").length;
