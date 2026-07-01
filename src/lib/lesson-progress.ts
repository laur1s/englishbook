export const LESSON_PROGRESS_KEY = "english-library.lesson-progress";

export const STUDY_STEP_IDS = ["notice", "retrieve", "produce", "correct"] as const;

export type StudyStepId = (typeof STUDY_STEP_IDS)[number];

export type LessonProgressRecord = {
  completedAt?: string;
  revision: number;
  schemaVersion: 1 | 2;
  updatedAt?: string;
  steps?: Partial<Record<StudyStepId, boolean>>;
};

export type LessonProgress = Record<string, LessonProgressRecord>;

export type LessonStudyState = {
  checkedCount: number;
  isCompleted: boolean;
  isReady: boolean;
  steps: Record<StudyStepId, boolean>;
  totalCount: number;
};

type LessonStudyUpdateOptions = {
  now?: string;
  revision?: number;
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  Boolean(value) && typeof value === "object" && !Array.isArray(value);

const validTimestamp = (value: unknown) =>
  typeof value === "string" && Number.isFinite(Date.parse(value)) ? value : undefined;

const validRevision = (value: unknown) =>
  Number.isInteger(value) && Number(value) > 0 ? Number(value) : 1;

const normalizeRecord = (value: unknown): LessonProgressRecord | undefined => {
  if (!isRecord(value)) return undefined;

  const completedAt = validTimestamp(value.completedAt);
  const updatedAt = validTimestamp(value.updatedAt);
  const rawSteps = isRecord(value.steps) ? value.steps : {};
  const steps = Object.fromEntries(
    STUDY_STEP_IDS.map((stepId) => [stepId, rawSteps[stepId] === true]),
  ) as Record<StudyStepId, boolean>;

  if (!completedAt && !STUDY_STEP_IDS.some((stepId) => steps[stepId])) {
    return undefined;
  }

  return {
    ...(completedAt ? { completedAt } : {}),
    revision: validRevision(value.revision),
    schemaVersion: value.schemaVersion === 2 ? 2 : 1,
    ...(updatedAt ? { updatedAt } : {}),
    steps,
  };
};

export const parseLessonProgress = (raw: string | null): LessonProgress => {
  if (!raw) return {};

  try {
    const parsed: unknown = JSON.parse(raw);
    if (!isRecord(parsed)) return {};

    return Object.fromEntries(
      Object.entries(parsed).flatMap(([slug, value]) => {
        const record = normalizeRecord(value);
        return record ? [[slug, record]] : [];
      }),
    );
  } catch {
    return {};
  }
};

export const getLessonStudyState = (
  progress: LessonProgress,
  slug: string,
  expectedRevision = 1,
): LessonStudyState => {
  const record = normalizeRecord(progress[slug]);
  const currentRecord = record?.revision === expectedRevision ? record : undefined;
  const legacyCompletion = currentRecord?.schemaVersion === 1 && Boolean(currentRecord.completedAt);
  const steps = Object.fromEntries(
    STUDY_STEP_IDS.map((stepId) => [
      stepId,
      legacyCompletion || currentRecord?.steps?.[stepId] === true,
    ]),
  ) as Record<StudyStepId, boolean>;
  const checkedCount = STUDY_STEP_IDS.filter((stepId) => steps[stepId]).length;
  const isReady = checkedCount === STUDY_STEP_IDS.length;

  return {
    checkedCount,
    isCompleted: Boolean(currentRecord?.completedAt) && isReady,
    isReady,
    steps,
    totalCount: STUDY_STEP_IDS.length,
  };
};

export const setLessonStudyStep = (
  progress: LessonProgress,
  slug: string,
  stepId: StudyStepId,
  checked: boolean,
  options: LessonStudyUpdateOptions = {},
): LessonProgress => {
  const revision = validRevision(options.revision);
  const now = options.now ?? new Date().toISOString();
  const current = getLessonStudyState(progress, slug, revision);
  const steps = { ...current.steps, [stepId]: checked };
  const isReady = STUDY_STEP_IDS.every((id) => steps[id]);
  const existing = normalizeRecord(progress[slug]);
  const existingCompletedAt = existing?.revision === revision ? existing.completedAt : undefined;
  const next = { ...progress };

  if (!STUDY_STEP_IDS.some((id) => steps[id])) {
    delete next[slug];
    return next;
  }

  next[slug] = {
    ...(isReady && existingCompletedAt ? { completedAt: existingCompletedAt } : {}),
    revision,
    schemaVersion: 2,
    updatedAt: now,
    steps,
  };
  return next;
};

export const completeLessonStudy = (
  progress: LessonProgress,
  slug: string,
  options: LessonStudyUpdateOptions = {},
): LessonProgress => {
  const revision = validRevision(options.revision);
  const now = options.now ?? new Date().toISOString();
  const state = getLessonStudyState(progress, slug, revision);
  if (!state.isReady) return progress;

  return {
    ...progress,
    [slug]: {
      completedAt: now,
      revision,
      schemaVersion: 2,
      updatedAt: now,
      steps: state.steps,
    },
  };
};

export const uncompleteLessonStudy = (
  progress: LessonProgress,
  slug: string,
  options: LessonStudyUpdateOptions = {},
): LessonProgress => {
  const revision = validRevision(options.revision);
  const now = options.now ?? new Date().toISOString();
  const state = getLessonStudyState(progress, slug, revision);
  if (!state.checkedCount) return progress;

  return {
    ...progress,
    [slug]: {
      revision,
      schemaVersion: 2,
      updatedAt: now,
      steps: state.steps,
    },
  };
};

export const resetLessonStudy = (progress: LessonProgress, slug: string): LessonProgress => {
  const next = { ...progress };
  delete next[slug];
  return next;
};

export const isLessonStudyCompleted = (
  progress: LessonProgress,
  slug: string,
  expectedRevision = 1,
) => getLessonStudyState(progress, slug, expectedRevision).isCompleted;
