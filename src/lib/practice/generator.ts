import type {
  PracticeCatalog,
  PracticeChoice,
  PracticeDifficulty,
  PracticeItem,
  PracticeMode,
  PracticeUnitSource,
  SingleChoicePracticeItem,
} from "./schema";

export const DEFAULT_PRACTICE_PACK_SIZE = 8;

type GeneratePracticePackCommonOptions = {
  mode: PracticeMode;
  count?: number;
  attempt?: number;
  recentItemIds?: readonly string[];
};

export type GeneratePracticePackOptions = GeneratePracticePackCommonOptions &
  (
    | { unitId: string; unitIds?: never }
    | { unitId?: never; unitIds: readonly string[] }
  );

export type PracticePack = {
  id: string;
  schemaVersion: number;
  generatorVersion: number;
  sourceHash: string;
  unitId: string | null;
  unitIds: string[];
  contentVersion: number | null;
  contentVersions: Record<string, number>;
  mode: PracticeMode;
  attempt: number;
  seed: string;
  items: PracticeItem[];
};

const DIFFICULTY_PATTERNS: Record<PracticeMode, readonly PracticeDifficulty[]> = {
  guided: [1, 1, 2, 1, 2, 1, 2, 3],
  standard: [2, 1, 2, 3, 2, 1, 3, 2],
  review: [3, 2, 3, 2, 1, 3, 2, 1],
  checkpoint: [2, 3, 2, 3, 1, 3, 2, 3],
};

export const hashPracticeSeed = (value: string) => {
  let hash = 0x811c9dc5;

  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }

  return hash >>> 0;
};

const createSeededSequence = (seed: string) => {
  let state = hashPracticeSeed(seed);

  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let value = state;
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
};

export const seededShuffle = <T>(values: readonly T[], seed: string): T[] => {
  const shuffled = [...values];
  const nextValue = createSeededSequence(seed);

  for (let index = shuffled.length - 1; index > 0; index -= 1) {
    const otherIndex = Math.floor(nextValue() * (index + 1));
    [shuffled[index], shuffled[otherIndex]] = [shuffled[otherIndex], shuffled[index]];
  }

  return shuffled;
};

const findUnit = (catalog: PracticeCatalog, unitId: string): PracticeUnitSource => {
  const unit = catalog.units.find((candidate) => candidate.unitId === unitId);

  if (!unit) {
    throw new RangeError(`Unknown practice unit “${unitId}”`);
  }

  return unit;
};

const resolveUnits = (
  catalog: PracticeCatalog,
  options: GeneratePracticePackOptions,
) => {
  const hasUnitId = typeof options.unitId === "string" && options.unitId.length > 0;
  const hasUnitIds = Array.isArray(options.unitIds);

  if (hasUnitId === hasUnitIds) {
    throw new TypeError("Provide exactly one of unitId or unitIds");
  }

  const requestedIds = hasUnitId ? [options.unitId as string] : [...(options.unitIds ?? [])];

  if (requestedIds.length === 0) {
    throw new RangeError("unitIds must contain at least one unit ID");
  }

  const uniqueIds = new Set(requestedIds);

  if (uniqueIds.size !== requestedIds.length) {
    throw new RangeError("unitIds must not contain duplicate unit IDs");
  }

  return [...uniqueIds]
    .sort((left, right) => left.localeCompare(right, "en"))
    .map((unitId) => findUnit(catalog, unitId));
};

const cloneItem = (item: PracticeItem): PracticeItem => {
  const common = {
    ...item,
    prompt: { ...item.prompt },
    rationale: { ...item.rationale },
    sourceRefs: item.sourceRefs.map((sourceRef) => ({ ...sourceRef })),
  };

  if (item.type === "single-choice") {
    return {
      ...common,
      type: "single-choice",
      choices: item.choices.map((choice) => ({ ...choice })),
      answer: { ...item.answer },
    };
  }

  return {
    ...common,
    type: "fill-blank",
    answer: {
      ...item.answer,
      accepted: [...item.answer.accepted],
    },
  };
};

const shuffleItemChoices = (item: PracticeItem, seed: string): PracticeItem => {
  const cloned = cloneItem(item);

  if (cloned.type !== "single-choice") {
    return cloned;
  }

  return {
    ...cloned,
    choices: seededShuffle(cloned.choices, seed),
  } satisfies SingleChoicePracticeItem;
};

const chooseCandidate = ({
  candidates,
  preferredDifficulty,
  selectedIds,
  objectiveCounts,
  recentItemIds,
  seed,
}: {
  candidates: readonly PracticeItem[];
  preferredDifficulty: PracticeDifficulty;
  selectedIds: ReadonlySet<string>;
  objectiveCounts: ReadonlyMap<string, number>;
  recentItemIds: ReadonlySet<string>;
  seed: string;
}) => {
  const remaining = candidates.filter((item) => !selectedIds.has(item.id));
  const fresh = remaining.filter((item) => !recentItemIds.has(item.id));
  const recencyPool = fresh.length ? fresh : remaining;
  const preferred = recencyPool.filter((item) => item.difficulty === preferredDifficulty);
  const pool = preferred.length ? preferred : recencyPool;

  return [...pool].sort((left, right) => {
    const recentDifference = Number(recentItemIds.has(left.id)) - Number(recentItemIds.has(right.id));

    if (recentDifference !== 0) {
      return recentDifference;
    }

    const objectiveDifference =
      (objectiveCounts.get(left.objectiveId) ?? 0) -
      (objectiveCounts.get(right.objectiveId) ?? 0);

    if (objectiveDifference !== 0) {
      return objectiveDifference;
    }

    const leftRank = hashPracticeSeed(`${seed}|${left.id}`);
    const rightRank = hashPracticeSeed(`${seed}|${right.id}`);

    if (leftRank !== rightRank) {
      return leftRank - rightRank;
    }

    return left.id.localeCompare(right.id);
  })[0];
};

const validateOptions = (
  units: readonly PracticeUnitSource[],
  options: GeneratePracticePackOptions,
) => {
  if (!Object.prototype.hasOwnProperty.call(DIFFICULTY_PATTERNS, options.mode)) {
    throw new RangeError(`Unknown practice mode “${String(options.mode)}”`);
  }

  const count = options.count ?? DEFAULT_PRACTICE_PACK_SIZE;
  const attempt = options.attempt ?? 1;

  if (!Number.isInteger(count) || count <= 0) {
    throw new RangeError("Practice pack count must be a positive integer");
  }

  const availableCount = units.reduce((total, unit) => total + unit.items.length, 0);

  if (count > availableCount) {
    throw new RangeError(
      `Practice pack count ${count} exceeds the ${availableCount} unique items in the requested unit pool`,
    );
  }

  if (!Number.isInteger(attempt) || attempt <= 0) {
    throw new RangeError("Practice attempt must be a positive integer");
  }

  return { count, attempt };
};

export const generatePracticePackFromCatalog = (
  catalog: PracticeCatalog,
  options: GeneratePracticePackOptions,
): PracticePack => {
  const units = resolveUnits(catalog, options);
  const { count, attempt } = validateOptions(units, options);
  const unitIds = units.map((unit) => unit.unitId);
  const contentVersions = Object.fromEntries(
    units.map((unit) => [unit.unitId, unit.contentVersion]),
  );
  const isSingleUnit = units.length === 1;
  const unitScope = units
    .map((unit) => `${unit.unitId}@${unit.contentVersion}`)
    .join(",");
  const seed = [
    `schema-${catalog.schemaVersion}`,
    `generator-${catalog.generatorVersion}`,
    catalog.sourceHash,
    `units-${unitScope}`,
    options.mode,
    `count-${count}`,
    `attempt-${attempt}`,
  ].join("|");
  const recentItemIds = new Set(options.recentItemIds ?? []);
  const selectedIds = new Set<string>();
  const objectiveCounts = new Map<string, number>();
  const selected: PracticeItem[] = [];
  const pattern = DIFFICULTY_PATTERNS[options.mode];
  const unitOrder = seededShuffle(units, `${seed}|unit-order`);

  for (let index = 0; index < count; index += 1) {
    const preferredDifficulty = pattern[index % pattern.length];
    const preferredUnitIndex = index % unitOrder.length;
    let candidate: PracticeItem | undefined;

    for (let offset = 0; offset < unitOrder.length && !candidate; offset += 1) {
      const unit = unitOrder[(preferredUnitIndex + offset) % unitOrder.length];
      candidate = chooseCandidate({
        candidates: unit.items,
        preferredDifficulty,
        selectedIds,
        objectiveCounts,
        recentItemIds,
        seed: `${seed}|position-${index}|unit-${unit.unitId}`,
      });
    }

    if (!candidate) {
      throw new Error(`Unable to select item ${index + 1} for ${unitIds.join(", ")}`);
    }

    selectedIds.add(candidate.id);
    objectiveCounts.set(
      candidate.objectiveId,
      (objectiveCounts.get(candidate.objectiveId) ?? 0) + 1,
    );
    selected.push(
      shuffleItemChoices(candidate, `${seed}|${candidate.id}|choices`),
    );
  }

  const selectionFingerprint = selected
    .map((item) => {
      const choices = item.type === "single-choice"
        ? item.choices.map((choice: PracticeChoice) => choice.id).join(",")
        : "gap";
      return `${item.id}@${item.revision}:${choices}`;
    })
    .join("|");
  const packHash = hashPracticeSeed(`${seed}|${selectionFingerprint}`)
    .toString(16)
    .padStart(8, "0");

  const idScope = isSingleUnit
    ? `${units[0].unitId}.${options.mode}.cv${units[0].contentVersion}`
    : `mixed-${unitIds[0]}-to-${unitIds[unitIds.length - 1]}.${options.mode}`;

  return {
    id: `${idScope}.gv${catalog.generatorVersion}.a${String(attempt).padStart(4, "0")}.${packHash}`,
    schemaVersion: catalog.schemaVersion,
    generatorVersion: catalog.generatorVersion,
    sourceHash: catalog.sourceHash,
    unitId: isSingleUnit ? units[0].unitId : null,
    unitIds,
    contentVersion: isSingleUnit ? units[0].contentVersion : null,
    contentVersions,
    mode: options.mode,
    attempt,
    seed,
    items: selected,
  };
};
