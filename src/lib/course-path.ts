import manifest from "../../learning/course-path.json" with { type: "json" };

export const COURSE_SESSION_STAGES = [
  "context",
  "learn",
  "practice",
  "speak",
  "review",
] as const;

export type CourseSessionStage = (typeof COURSE_SESSION_STAGES)[number];
export type PracticeMode = "guided" | "standard" | "review" | "checkpoint";

type SharedSession = {
  id: string;
  title: string;
  stage: CourseSessionStage;
  revision: number;
  minutes: number;
  required: boolean;
  skillRefs: string[];
};

export type ContentCourseSession = SharedSession & {
  kind: "content";
  href: string;
};

export type PracticeCourseSession = SharedSession & {
  kind: "practice";
  mode: PracticeMode;
  count: number;
} & (
  | { unitId: string; unitIds?: never }
  | { unitId?: never; unitIds: string[] }
);

export type CourseSession = ContentCourseSession | PracticeCourseSession;

export type CourseModule = {
  id: string;
  order: number;
  title: string;
  unitSlug: string;
  missionSlug: string;
  storySlug?: string;
  summary: string;
  sessions: CourseSession[];
};

export type CoursePath = {
  id: string;
  title: string;
  level: string;
  version: number;
  modules: CourseModule[];
};

const EXPECTED_MODULE_TITLES = [
  "Foundations",
  "Daily life",
  "Past stories",
  "Food & shopping",
  "Travel",
  "Future plans",
  "Life experience",
  "Comparisons",
  "Advice & possibility",
  "Present tenses",
  "Storytelling",
  "A2 checkpoint",
  "Everyday objects",
  "Personal connections",
  "Home responsibilities",
  "Health & wellbeing",
  "Weather & clothing",
  "Work & learning",
  "Technology",
  "Social plans",
  "Environment",
  "Services & solutions",
  "Descriptions & recommendations",
  "A2 communication project",
] as const;

const EXPECTED_MISSION_SLUGS = [
  "introduce-yourself-fast",
  "my-ordinary-day",
  "tell-a-weekend-story",
  "restaurant-rescue",
  "lost-but-clear",
  "weekend-plan-sprint",
  "life-experience-sprint",
  "comparison-clinic",
  "advice-or-maybe",
  "habit-now-experience",
  "when-it-happened",
  "a2-real-life-challenge",
  "lost-property-desk",
  "whose-is-it",
  "house-rules-meeting",
  "pharmacy-conversation",
  "weather-backup-plan",
  "course-help-desk",
  "tech-support-call",
  "invitation-switch",
  "eco-choice-challenge",
  "calm-complaint",
  "recommendation-chain",
  "host-a-weekend",
] as const;

const RESOURCE_CONTEXT_HREFS = new Set([
  "/resources/grammar-reference#past-continuous",
  "/resources/vocabulary-lists",
]);

const isRecord = (value: unknown): value is Record<string, unknown> =>
  Boolean(value) && typeof value === "object" && !Array.isArray(value);

function fail(message: string): never {
  throw new Error(`Invalid course path: ${message}`);
}

const requiredString = (
  record: Record<string, unknown>,
  field: string,
  context: string,
): string => {
  const value = record[field];

  if (typeof value !== "string" || !value.trim()) {
    fail(`${context}.${field} must be a non-empty string`);
  }

  return value as string;
};

const requiredPositiveInteger = (
  record: Record<string, unknown>,
  field: string,
  context: string,
): number => {
  const value = record[field];

  if (!Number.isInteger(value) || Number(value) <= 0) {
    fail(`${context}.${field} must be a positive integer`);
  }

  return Number(value);
};

const readSkillRefs = (record: Record<string, unknown>, context: string): string[] => {
  const value = record.skillRefs;

  if (!Array.isArray(value) || value.length === 0) {
    fail(`${context}.skillRefs must contain at least one skill reference`);
  }

  const refs = (value as unknown[]).map((item, index) => {
    if (typeof item !== "string" || !/^[a-z0-9]+(?:[.-][a-z0-9]+)*$/.test(item)) {
      fail(`${context}.skillRefs[${index}] is not a valid skill reference`);
    }

    return item;
  });

  if (new Set(refs).size !== refs.length) {
    fail(`${context}.skillRefs contains duplicates`);
  }

  return refs;
};

const duplicateValue = (values: unknown[]) => {
  const seen = new Set<string>();

  for (const value of values) {
    if (typeof value === "string") {
      if (seen.has(value)) {
        return value;
      }

      seen.add(value);
    }
  }

  return undefined;
};

const parseSession = (
  value: unknown,
  module: {
    id: string;
    unitSlug: string;
    missionSlug: string;
    storySlug?: string;
  },
): CourseSession => {
  if (!isRecord(value)) {
    fail(`${module.id} contains a session that is not an object`);
  }

  const record = value as Record<string, unknown>;
  const context = `${module.id}.session`;
  const id = requiredString(record, "id", context);
  const title = requiredString(record, "title", id);
  const stage = requiredString(record, "stage", id);

  if (!COURSE_SESSION_STAGES.includes(stage as CourseSessionStage)) {
    fail(`${id}.stage “${stage}” is not supported`);
  }

  if (id !== `${module.id}-${stage}`) {
    fail(`${id} must use the stable id ${module.id}-${stage}`);
  }

  const kind = requiredString(record, "kind", id);
  const expectedKind = stage === "practice" || stage === "review" ? "practice" : "content";

  if (kind !== expectedKind) {
    fail(`${id}.kind must be ${expectedKind} for the ${stage} stage`);
  }

  const minutes = requiredPositiveInteger(record, "minutes", id);
  const revision = record.revision === undefined
    ? 1
    : requiredPositiveInteger(record, "revision", id);

  if (typeof record.required !== "boolean") {
    fail(`${id}.required must be a boolean`);
  }

  const required = record.required as boolean;
  const skillRefs = readSkillRefs(record, id);

  if (kind === "content") {
    const href = requiredString(record, "href", id);

    if (!href.startsWith("/")) {
      fail(`${id}.href must be an absolute site path`);
    }

    const expectedHref =
      stage === "learn"
        ? `/a2/${module.unitSlug}`
        : stage === "speak"
          ? `/speaking/${module.missionSlug}`
          : module.storySlug
            ? `/grey-book/${module.storySlug}`
            : undefined;

    if (expectedHref && href !== expectedHref) {
      fail(`${id}.href must reference ${expectedHref}`);
    }

    if (
      stage === "context" &&
      !module.storySlug &&
      !RESOURCE_CONTEXT_HREFS.has(href) &&
      href !== `/a2/${module.unitSlug}` &&
      !href.startsWith(`/a2/${module.unitSlug}#`)
    ) {
      fail(`${id}.href is not an approved resource context`);
    }

    return {
      id,
      title,
      kind: "content",
      stage: stage as CourseSessionStage,
      revision,
      minutes,
      href,
      required,
      skillRefs,
    };
  }

  const mode = requiredString(record, "mode", id);
  const count = requiredPositiveInteger(record, "count", id);
  const supportedModes: PracticeMode[] =
    stage === "practice" ? ["guided", "standard"] : ["review", "checkpoint"];

  if (!supportedModes.includes(mode as PracticeMode)) {
    fail(`${id}.mode “${mode}” is not supported for the ${stage} stage`);
  }

  if (mode === "checkpoint") {
    if (!Array.isArray(record.unitIds) || record.unitIds.length < 2) {
      fail(`${id}.unitIds must contain at least two units for a checkpoint`);
    }

    const unitIds = record.unitIds.map((unitId, index) => {
      if (typeof unitId !== "string" || !/^unit-(0[1-9]|1[0-9]|2[0-4])$/.test(unitId)) {
        fail(`${id}.unitIds[${index}] must be a valid unit ID`);
      }
      return unitId;
    });

    if (new Set(unitIds).size !== unitIds.length) {
      fail(`${id}.unitIds contains duplicates`);
    }

    if (count < unitIds.length) {
      fail(`${id}.count must allow at least one question for every checkpoint unit`);
    }

    if (!unitIds.includes(module.unitSlug)) {
      fail(`${id}.unitIds must include the current unit ${module.unitSlug}`);
    }

    const moduleOrder = Number(module.id.slice(-2));
    const checkpointStarts: Record<number, number> = {
      3: 1,
      6: 1,
      9: 7,
      12: 1,
      15: 13,
      18: 13,
      21: 19,
      24: 1,
    };
    const firstOrder = checkpointStarts[moduleOrder];

    if (!firstOrder) {
      fail(`${id}.mode checkpoint is not scheduled for module ${moduleOrder}`);
    }
    const expectedUnitIds = Array.from(
      { length: moduleOrder - firstOrder + 1 },
      (_, index) => `unit-${String(firstOrder + index).padStart(2, "0")}`,
    );

    if (unitIds.join("|") !== expectedUnitIds.join("|")) {
      fail(`${id}.unitIds must be ${expectedUnitIds.join(", ")}`);
    }

    return {
      id,
      title,
      kind: "practice",
      stage: stage as CourseSessionStage,
      revision,
      minutes,
      unitIds,
      mode: mode as PracticeMode,
      count,
      required,
      skillRefs,
    };
  }

  const unitId = requiredString(record, "unitId", id);

  if (unitId !== module.unitSlug) {
    fail(`${id}.unitId must reference ${module.unitSlug}`);
  }

  return {
    id,
    title,
    kind: "practice",
    stage: stage as CourseSessionStage,
    revision,
    minutes,
    unitId,
    mode: mode as PracticeMode,
    count,
    required,
    skillRefs,
  };
};

export const validateCoursePath = (value: unknown): CoursePath => {
  if (!isRecord(value)) {
    fail("manifest must be an object");
  }

  const record = value as Record<string, unknown>;
  const id = requiredString(record, "id", "coursePath");
  const title = requiredString(record, "title", "coursePath");
  const level = requiredString(record, "level", "coursePath");
  const version = requiredPositiveInteger(record, "version", "coursePath");
  const rawModulesValue = record.modules;

  if (!Array.isArray(rawModulesValue)) {
    fail("modules must be an array");
  }

  const rawModules = rawModulesValue as unknown[];

  const duplicateModuleId = duplicateValue(
    rawModules.map((item) => (isRecord(item) ? item.id : undefined)),
  );

  if (duplicateModuleId) {
    fail(`Duplicate module id “${duplicateModuleId}”`);
  }

  const rawSessions = rawModules.flatMap((item) =>
    isRecord(item) && Array.isArray(item.sessions) ? item.sessions : [],
  );
  const duplicateSessionId = duplicateValue(
    rawSessions.map((item) => (isRecord(item) ? item.id : undefined)),
  );

  if (duplicateSessionId) {
    fail(`Duplicate session id “${duplicateSessionId}”`);
  }

  if (rawModules.length !== 24) {
    fail("must contain exactly 24 modules with no order gaps");
  }

  const parsedModules = rawModules.map((item, sourceIndex) => {
    if (!isRecord(item)) {
      fail(`modules[${sourceIndex}] must be an object`);
    }

    const moduleRecord = item as Record<string, unknown>;
    const context = `modules[${sourceIndex}]`;
    const moduleId = requiredString(moduleRecord, "id", context);
    const order = requiredPositiveInteger(moduleRecord, "order", moduleId);
    const moduleTitle = requiredString(moduleRecord, "title", moduleId);
    const unitSlug = requiredString(moduleRecord, "unitSlug", moduleId);
    const missionSlug = requiredString(moduleRecord, "missionSlug", moduleId);
    const summary = requiredString(moduleRecord, "summary", moduleId);
    const storySlug = moduleRecord.storySlug;

    if (storySlug !== undefined && (typeof storySlug !== "string" || !storySlug.trim())) {
      fail(`${moduleId}.storySlug must be a non-empty string when supplied`);
    }

    if (order >= 1 && order <= EXPECTED_MODULE_TITLES.length) {
      const suffix = String(order).padStart(2, "0");
      const expectedUnitSlug = `unit-${suffix}`;
      const expectedStorySlug = order <= 12 ? `chapter-${suffix}` : undefined;

      if (unitSlug !== expectedUnitSlug) {
        fail(`${moduleId}.unitSlug must reference ${expectedUnitSlug}`);
      }

      if (missionSlug !== EXPECTED_MISSION_SLUGS[order - 1]) {
        fail(`${moduleId}.missionSlug is not the current mission reference`);
      }

      if (storySlug !== expectedStorySlug) {
        fail(
          expectedStorySlug
            ? `${moduleId}.storySlug must reference ${expectedStorySlug}`
            : `${moduleId} must use a resource context instead of a storySlug`,
        );
      }
    }

    if (!Array.isArray(moduleRecord.sessions)) {
      fail(`${moduleId}.sessions must be an array`);
    }

    const rawModuleSessions = moduleRecord.sessions as unknown[];

    if (rawModuleSessions.length !== COURSE_SESSION_STAGES.length) {
      fail(`${moduleId} must contain exactly five sessions`);
    }

    const moduleReference = {
      id: moduleId,
      unitSlug,
      missionSlug,
      storySlug: typeof storySlug === "string" ? storySlug : undefined,
    };

    const parsedSessions = rawModuleSessions.map((session) => parseSession(session, moduleReference));
    const orderedSessions = [...parsedSessions].sort(
      (left, right) =>
        COURSE_SESSION_STAGES.indexOf(left.stage) - COURSE_SESSION_STAGES.indexOf(right.stage),
    );

    for (const [index, stage] of COURSE_SESSION_STAGES.entries()) {
      if (orderedSessions[index]?.stage !== stage) {
        fail(`${moduleId} is missing the ${stage} session stage`);
      }
    }

    return {
      id: moduleId,
      order,
      title: moduleTitle,
      unitSlug,
      missionSlug,
      ...(typeof storySlug === "string" ? { storySlug } : {}),
      summary,
      sessions: orderedSessions,
    } satisfies CourseModule;
  });

  const orderedModules = [...parsedModules].sort((left, right) => left.order - right.order);

  for (const [index, module] of orderedModules.entries()) {
    const order = index + 1;
    const suffix = String(order).padStart(2, "0");
    const expectedId = `module-${suffix}`;
    const expectedUnitSlug = `unit-${suffix}`;
    const expectedStorySlug = order <= 12 ? `chapter-${suffix}` : undefined;

    if (module.order !== order) {
      fail(`module order has a gap before ${module.id}`);
    }

    if (module.id !== expectedId) {
      fail(`module ${order} must use the stable id ${expectedId}`);
    }

    if (module.title !== EXPECTED_MODULE_TITLES[index]) {
      fail(`${module.id}.title must be “${EXPECTED_MODULE_TITLES[index]}”`);
    }

    if (module.unitSlug !== expectedUnitSlug) {
      fail(`${module.id}.unitSlug must reference ${expectedUnitSlug}`);
    }

    if (module.missionSlug !== EXPECTED_MISSION_SLUGS[index]) {
      fail(`${module.id}.missionSlug is not the current mission reference`);
    }

    if (module.storySlug !== expectedStorySlug) {
      fail(
        expectedStorySlug
          ? `${module.id}.storySlug must reference ${expectedStorySlug}`
          : `${module.id} must use a resource context instead of a storySlug`,
      );
    }
  }

  return { id, title, level, version, modules: orderedModules };
};

export const coursePath = validateCoursePath(manifest);
export const modules = coursePath.modules;
export const sessions = modules.flatMap((module) => module.sessions);

const moduleById = new Map(modules.map((module) => [module.id, module]));
const sessionById = new Map(sessions.map((session) => [session.id, session]));
const sessionIndexById = new Map(sessions.map((session, index) => [session.id, index]));

export const getModuleById = (id: string) => moduleById.get(id);
export const getSessionById = (id: string) => sessionById.get(id);
export const getNextSessionId = (id: string) => {
  const index = sessionIndexById.get(id);
  return index === undefined
    ? undefined
    : sessions.slice(index + 1).find((session) => session.required)?.id;
};
