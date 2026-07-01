export const LEARNING_PROGRESS_KEY = "english-library.learning.v1";
export const LEARNING_PROGRESS_VERSION = 1;

export type StorageLike = Pick<Storage, "getItem" | "setItem">;

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

type SessionRef = { id: string };

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

    return {
      version: LEARNING_PROGRESS_VERSION,
      activeSessionId: typeof parsed.activeSessionId === "string" ? parsed.activeSessionId : null,
      sessions: isRecord(parsed.sessions)
        ? (parsed.sessions as LearningProgress["sessions"])
        : {},
      skills: isRecord(parsed.skills) ? (parsed.skills as LearningProgress["skills"]) : {},
      practiceAttempts: isRecord(parsed.practiceAttempts)
        ? (parsed.practiceAttempts as LearningProgress["practiceAttempts"])
        : {},
      recentItemIds: Array.isArray(parsed.recentItemIds)
        ? parsed.recentItemIds.filter((item): item is string => typeof item === "string").slice(-40)
        : [],
      activeDays: Array.isArray(parsed.activeDays)
        ? parsed.activeDays.filter((item): item is string => typeof item === "string").slice(-90)
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

  return withActiveDay({
    ...progress,
    activeSessionId: sessionId,
    sessions: { ...progress.sessions, [sessionId]: session },
  }, now);
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
    const intervalDays = nextInterval(previous, accuracy);
    skills[skillId] = {
      strength: clamp(previous ? previous.strength * 0.55 + accuracy * 0.45 : accuracy),
      intervalDays,
      lastSeenAt: now,
      dueAt: addDays(now, intervalDays),
      lapses: (previous?.lapses ?? 0) + (accuracy < 0.6 ? 1 : 0),
      sourceSessionId: sessionId,
    };
  }

  return withActiveDay({
    ...started,
    activeSessionId: options.nextSessionId ?? null,
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
    [sessionId]: (progress.practiceAttempts[sessionId] ?? 0) + 1,
  },
});

export const getNextLearningSessionId = (
  orderedSessions: SessionRef[],
  progress: LearningProgress,
) => {
  if (
    progress.activeSessionId &&
    orderedSessions.some((session) => session.id === progress.activeSessionId) &&
    progress.sessions[progress.activeSessionId]?.status !== "completed"
  ) {
    return progress.activeSessionId;
  }

  return orderedSessions.find((session) => progress.sessions[session.id]?.status !== "completed")?.id
    ?? orderedSessions.at(-1)?.id
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
