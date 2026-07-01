export type RunnerSession = {
  id: string;
  kind: "content" | "practice";
  stage: "context" | "learn" | "practice" | "speak" | "review";
  title: string;
  minutes: number;
  skillRefs: string[];
  unitId?: string;
  unitIds?: string[];
  mode?: "guided" | "standard" | "review" | "checkpoint";
  count?: number;
};

export type RunnerData = {
  revision: number;
  module: { id: string; order: number; title: string };
  moduleSessions: Array<{
    id: string;
    stage: RunnerSession["stage"];
    revision: number;
    required: boolean;
  }>;
  pathSessions: Array<{ id: string; revision: number; required: boolean }>;
  session: RunnerSession;
  nextSessionId: string | null;
  nextHref: string;
  dashboardHref: string;
  studyEvidence: {
    slug: string;
    revision: number;
    sourceLabel: "lesson" | "reading";
  } | null;
};

export type RunnerDataResult =
  | { ok: true; data: RunnerData }
  | { ok: false; reason: "missing" | "malformed" | "invalid"; message: string };

const stages = new Set(["context", "learn", "practice", "speak", "review"]);
const practiceModes = new Set(["guided", "standard", "review", "checkpoint"]);

const isRecord = (value: unknown): value is Record<string, unknown> =>
  Boolean(value) && typeof value === "object" && !Array.isArray(value);

const isText = (value: unknown): value is string =>
  typeof value === "string" && value.trim().length > 0;

const isPositiveInteger = (value: unknown): value is number =>
  Number.isInteger(value) && Number(value) > 0;

const isSessionRef = (value: unknown) =>
  isRecord(value) &&
  isText(value.id) &&
  isPositiveInteger(value.revision) &&
  typeof value.required === "boolean";

const isRunnerSession = (value: unknown): value is RunnerSession => {
  if (
    !isRecord(value) ||
    !isText(value.id) ||
    (value.kind !== "content" && value.kind !== "practice") ||
    !isText(value.stage) ||
    !stages.has(value.stage) ||
    !isText(value.title) ||
    !isPositiveInteger(value.minutes) ||
    !Array.isArray(value.skillRefs) ||
    !value.skillRefs.length ||
    !value.skillRefs.every(isText)
  ) {
    return false;
  }

  if (value.kind !== "practice") return true;

  const hasUnit = isText(value.unitId) || (
    Array.isArray(value.unitIds) &&
    value.unitIds.length > 0 &&
    value.unitIds.every(isText)
  );

  return hasUnit &&
    isText(value.mode) &&
    practiceModes.has(value.mode) &&
    isPositiveInteger(value.count);
};

const isStudyEvidence = (value: unknown) =>
  value === null || (
    isRecord(value) &&
    isText(value.slug) &&
    isPositiveInteger(value.revision) &&
    (value.sourceLabel === "lesson" || value.sourceLabel === "reading")
  );

const isRunnerData = (value: unknown): value is RunnerData => {
  if (!isRecord(value) || !isRecord(value.module) || !isRunnerSession(value.session)) {
    return false;
  }

  return isPositiveInteger(value.revision) &&
    isText(value.module.id) &&
    isPositiveInteger(value.module.order) &&
    isText(value.module.title) &&
    Array.isArray(value.moduleSessions) &&
    value.moduleSessions.length > 0 &&
    value.moduleSessions.every((session) =>
      isSessionRef(session) && isText(session.stage) && stages.has(session.stage)
    ) &&
    Array.isArray(value.pathSessions) &&
    value.pathSessions.length > 0 &&
    value.pathSessions.every(isSessionRef) &&
    (value.nextSessionId === null || isText(value.nextSessionId)) &&
    isText(value.nextHref) &&
    isText(value.dashboardHref) &&
    isStudyEvidence(value.studyEvidence);
};

export const parseRunnerData = (source: string | null | undefined): RunnerDataResult => {
  if (!source?.trim()) {
    return {
      ok: false,
      reason: "missing",
      message: "Session setup data is missing.",
    };
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(source);
  } catch {
    return {
      ok: false,
      reason: "malformed",
      message: "Session setup data could not be read.",
    };
  }

  if (!isRunnerData(parsed)) {
    return {
      ok: false,
      reason: "invalid",
      message: "Session setup data is incomplete or invalid.",
    };
  }

  return { ok: true, data: parsed };
};
