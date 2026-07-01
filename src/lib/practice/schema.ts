export const PRACTICE_SCHEMA_VERSION = 1 as const;
export const PRACTICE_GENERATOR_VERSION = 2 as const;

export type PracticeDifficulty = 1 | 2 | 3;
export type PracticeMode = "guided" | "standard" | "review" | "checkpoint";
export type PracticeItemType = "single-choice" | "fill-blank";

export type BilingualText = {
  en: string;
  lt: string;
};

export type PracticeObjective = {
  id: string;
  label: BilingualText;
};

export type PracticeSourceRef = {
  lesson: string;
  exercise: number;
};

export type PracticeChoice = {
  id: string;
  text: string;
};

type PracticeItemBase = {
  id: string;
  revision: number;
  objectiveId: string;
  difficulty: PracticeDifficulty;
  prompt: BilingualText;
  rationale: BilingualText;
  sourceRefs: PracticeSourceRef[];
};

export type SingleChoicePracticeItem = PracticeItemBase & {
  type: "single-choice";
  choices: PracticeChoice[];
  answer: {
    choiceId: string;
  };
};

export type FillBlankPracticeItem = PracticeItemBase & {
  type: "fill-blank";
  answer: {
    accepted: string[];
    caseSensitive: boolean;
  };
};

export type PracticeItem = SingleChoicePracticeItem | FillBlankPracticeItem;

export type PracticeUnitSource = {
  schemaVersion: typeof PRACTICE_SCHEMA_VERSION;
  unitId: string;
  contentVersion: number;
  title: string;
  objectives: PracticeObjective[];
  items: PracticeItem[];
};

export type PracticeCatalog = {
  schemaVersion: typeof PRACTICE_SCHEMA_VERSION;
  generatorVersion: number;
  sourceHash: string;
  units: PracticeUnitSource[];
};

export class PracticeValidationError extends Error {
  readonly issues: string[];

  constructor(issues: string[]) {
    super(`Practice data validation failed:\n- ${issues.join("\n- ")}`);
    this.name = "PracticeValidationError";
    this.issues = issues;
  }
}

const UNIT_ID_PATTERN = /^unit-(0[1-9]|1[0-2])$/;
const OBJECTIVE_ID_PATTERN = /^u(0[1-9]|1[0-2])\.[a-z0-9]+(?:[.-][a-z0-9]+)*$/;
const ITEM_ID_PATTERN = /^u(0[1-9]|1[0-2])\.[a-z0-9]+(?:[.-][a-z0-9]+)*\.\d{3}$/;
const CHOICE_ID_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

const isRecord = (value: unknown): value is Record<string, unknown> =>
  Boolean(value) && typeof value === "object" && !Array.isArray(value);

const isPositiveInteger = (value: unknown): value is number =>
  Number.isInteger(value) && Number(value) > 0;

const isNonEmptyString = (value: unknown): value is string =>
  typeof value === "string" && value.trim().length > 0;

const addIssue = (issues: string[], path: string, message: string) => {
  issues.push(`${path}: ${message}`);
};

const validateBilingualText = (
  value: unknown,
  path: string,
  issues: string[],
) => {
  if (!isRecord(value)) {
    addIssue(issues, path, "must be an object with non-empty en and lt text");
    return;
  }

  if (!isNonEmptyString(value.en)) {
    addIssue(issues, `${path}.en`, "must be a non-empty string");
  }

  if (!isNonEmptyString(value.lt)) {
    addIssue(issues, `${path}.lt`, "must be a non-empty string");
  }
};

const validateSourceRef = (
  value: unknown,
  path: string,
  issues: string[],
) => {
  if (!isRecord(value)) {
    addIssue(issues, path, "must be an object");
    return;
  }

  if (!isNonEmptyString(value.lesson) || !UNIT_ID_PATTERN.test(value.lesson)) {
    addIssue(issues, `${path}.lesson`, "must be a unit ID such as unit-01");
  }

  if (!isPositiveInteger(value.exercise)) {
    addIssue(issues, `${path}.exercise`, "must be a positive integer");
  }
};

const validateItem = (
  value: unknown,
  path: string,
  unitId: string,
  objectiveIds: Set<string>,
  issues: string[],
) => {
  if (!isRecord(value)) {
    addIssue(issues, path, "must be an object");
    return;
  }

  const unitNumber = unitId.slice(-2);

  if (!isNonEmptyString(value.id) || !ITEM_ID_PATTERN.test(value.id)) {
    addIssue(issues, `${path}.id`, "must be a stable ID such as u01.be-agreement.001");
  } else if (!value.id.startsWith(`u${unitNumber}.`)) {
    addIssue(issues, `${path}.id`, `must use the u${unitNumber}. prefix`);
  }

  if (!isPositiveInteger(value.revision)) {
    addIssue(issues, `${path}.revision`, "must be a positive integer");
  }

  if (!isNonEmptyString(value.objectiveId) || !objectiveIds.has(value.objectiveId)) {
    addIssue(issues, `${path}.objectiveId`, "must reference an objective in the same unit");
  }

  if (value.difficulty !== 1 && value.difficulty !== 2 && value.difficulty !== 3) {
    addIssue(issues, `${path}.difficulty`, "must be 1, 2, or 3");
  }

  validateBilingualText(value.prompt, `${path}.prompt`, issues);
  validateBilingualText(value.rationale, `${path}.rationale`, issues);

  if (!Array.isArray(value.sourceRefs) || value.sourceRefs.length === 0) {
    addIssue(issues, `${path}.sourceRefs`, "must contain at least one lesson reference");
  } else {
    value.sourceRefs.forEach((sourceRef, index) => {
      validateSourceRef(sourceRef, `${path}.sourceRefs[${index}]`, issues);

      if (isRecord(sourceRef) && sourceRef.lesson !== unitId) {
        addIssue(issues, `${path}.sourceRefs[${index}].lesson`, `must equal ${unitId}`);
      }
    });
  }

  if (value.type === "single-choice") {
    if (!Array.isArray(value.choices) || value.choices.length < 2) {
      addIssue(issues, `${path}.choices`, "must contain at least two choices");
      return;
    }

    const choiceIds = new Set<string>();
    const choiceTexts = new Set<string>();

    value.choices.forEach((choice, index) => {
      const choicePath = `${path}.choices[${index}]`;

      if (!isRecord(choice)) {
        addIssue(issues, choicePath, "must be an object");
        return;
      }

      if (!isNonEmptyString(choice.id) || !CHOICE_ID_PATTERN.test(choice.id)) {
        addIssue(issues, `${choicePath}.id`, "must be a lowercase stable ID");
      } else if (choiceIds.has(choice.id)) {
        addIssue(issues, `${choicePath}.id`, `duplicate choice ID “${choice.id}”`);
      } else {
        choiceIds.add(choice.id);
      }

      if (!isNonEmptyString(choice.text)) {
        addIssue(issues, `${choicePath}.text`, "must be a non-empty string");
      } else {
        const normalizedText = choice.text.trim().toLocaleLowerCase("en");

        if (choiceTexts.has(normalizedText)) {
          addIssue(issues, `${choicePath}.text`, `duplicate choice text “${choice.text}”`);
        }

        choiceTexts.add(normalizedText);
      }
    });

    if (!isRecord(value.answer) || !isNonEmptyString(value.answer.choiceId)) {
      addIssue(issues, `${path}.answer.choiceId`, "must be a non-empty choice ID");
    } else if (!choiceIds.has(value.answer.choiceId)) {
      addIssue(issues, `${path}.answer.choiceId`, "must reference one of the item choices");
    }

    return;
  }

  if (value.type === "fill-blank") {
    if (!isRecord(value.answer)) {
      addIssue(issues, `${path}.answer`, "must be an object");
      return;
    }

    const answer = value.answer;

    if (!Array.isArray(answer.accepted) || answer.accepted.length === 0) {
      addIssue(issues, `${path}.answer.accepted`, "must contain at least one accepted answer");
    } else {
      const accepted = new Set<string>();

      answer.accepted.forEach((acceptedAnswer, index) => {
        if (!isNonEmptyString(acceptedAnswer)) {
          addIssue(issues, `${path}.answer.accepted[${index}]`, "must be a non-empty string");
          return;
        }

        const normalized = acceptedAnswer.trim().replace(/[’‘]/g, "'").replace(/\s+/g, " ");
        const comparison = answer.caseSensitive === true
          ? normalized
          : normalized.toLocaleLowerCase("en");

        if (accepted.has(comparison)) {
          addIssue(issues, `${path}.answer.accepted[${index}]`, "duplicates another accepted answer");
        }

        accepted.add(comparison);
      });
    }

    if (typeof answer.caseSensitive !== "boolean") {
      addIssue(issues, `${path}.answer.caseSensitive`, "must be true or false");
    }

    return;
  }

  addIssue(issues, `${path}.type`, "must be single-choice or fill-blank");
};

export const validatePracticeSource = (
  input: unknown,
  sourceName = "practice source",
): PracticeUnitSource => {
  const issues: string[] = [];
  const path = sourceName;

  if (!isRecord(input)) {
    throw new PracticeValidationError([`${path}: must be an object`]);
  }

  if (input.schemaVersion !== PRACTICE_SCHEMA_VERSION) {
    addIssue(issues, `${path}.schemaVersion`, `must equal ${PRACTICE_SCHEMA_VERSION}`);
  }

  if (!isNonEmptyString(input.unitId) || !UNIT_ID_PATTERN.test(input.unitId)) {
    addIssue(issues, `${path}.unitId`, "must be unit-01 through unit-12");
  }

  if (!isPositiveInteger(input.contentVersion)) {
    addIssue(issues, `${path}.contentVersion`, "must be a positive integer");
  }

  if (!isNonEmptyString(input.title)) {
    addIssue(issues, `${path}.title`, "must be a non-empty string");
  }

  const objectiveIds = new Set<string>();

  if (!Array.isArray(input.objectives) || input.objectives.length === 0) {
    addIssue(issues, `${path}.objectives`, "must contain at least one objective");
  } else {
    const unitNumber = isNonEmptyString(input.unitId) ? input.unitId.slice(-2) : "";

    input.objectives.forEach((objective, index) => {
      const objectivePath = `${path}.objectives[${index}]`;

      if (!isRecord(objective)) {
        addIssue(issues, objectivePath, "must be an object");
        return;
      }

      if (!isNonEmptyString(objective.id) || !OBJECTIVE_ID_PATTERN.test(objective.id)) {
        addIssue(issues, `${objectivePath}.id`, "must be a stable ID such as u01.be-agreement");
      } else {
        if (unitNumber && !objective.id.startsWith(`u${unitNumber}.`)) {
          addIssue(issues, `${objectivePath}.id`, `must use the u${unitNumber}. prefix`);
        }

        if (objectiveIds.has(objective.id)) {
          addIssue(issues, `${objectivePath}.id`, `duplicate objective ID “${objective.id}”`);
        }

        objectiveIds.add(objective.id);
      }

      validateBilingualText(objective.label, `${objectivePath}.label`, issues);
    });
  }

  const itemIds = new Set<string>();

  if (!Array.isArray(input.items) || input.items.length < 10) {
    addIssue(issues, `${path}.items`, "must contain at least ten practice items");
  } else {
    input.items.forEach((item, index) => {
      validateItem(item, `${path}.items[${index}]`, String(input.unitId ?? ""), objectiveIds, issues);

      if (isRecord(item) && isNonEmptyString(item.id)) {
        if (itemIds.has(item.id)) {
          addIssue(issues, `${path}.items[${index}].id`, `duplicate item ID “${item.id}”`);
        }

        itemIds.add(item.id);
      }
    });
  }

  if (issues.length) {
    throw new PracticeValidationError(issues);
  }

  return input as PracticeUnitSource;
};

export const validatePracticeCatalog = (input: unknown): PracticeCatalog => {
  const issues: string[] = [];

  if (!isRecord(input)) {
    throw new PracticeValidationError(["practice catalog: must be an object"]);
  }

  if (input.schemaVersion !== PRACTICE_SCHEMA_VERSION) {
    addIssue(issues, "practice catalog.schemaVersion", `must equal ${PRACTICE_SCHEMA_VERSION}`);
  }

  if (!isPositiveInteger(input.generatorVersion)) {
    addIssue(issues, "practice catalog.generatorVersion", "must be a positive integer");
  }

  if (
    !isNonEmptyString(input.sourceHash) ||
    !/^sha256-[a-f0-9]{64}$/.test(input.sourceHash)
  ) {
    addIssue(issues, "practice catalog.sourceHash", "must be a SHA-256 source hash");
  }

  const unitIds = new Set<string>();
  const objectiveIds = new Set<string>();
  const itemIds = new Set<string>();

  if (!Array.isArray(input.units) || input.units.length === 0) {
    addIssue(issues, "practice catalog.units", "must contain at least one unit");
  } else {
    input.units.forEach((unit, unitIndex) => {
      const unitPath = `practice catalog.units[${unitIndex}]`;

      try {
        const validated = validatePracticeSource(unit, unitPath);

        if (unitIds.has(validated.unitId)) {
          addIssue(issues, `${unitPath}.unitId`, `duplicate unit ID “${validated.unitId}”`);
        }

        unitIds.add(validated.unitId);

        validated.objectives.forEach((objective) => {
          if (objectiveIds.has(objective.id)) {
            addIssue(issues, unitPath, `duplicate global objective ID “${objective.id}”`);
          }

          objectiveIds.add(objective.id);
        });

        validated.items.forEach((item) => {
          if (itemIds.has(item.id)) {
            addIssue(issues, unitPath, `duplicate global item ID “${item.id}”`);
          }

          itemIds.add(item.id);
        });
      } catch (error) {
        if (error instanceof PracticeValidationError) {
          issues.push(...error.issues);
        } else {
          addIssue(issues, unitPath, String(error));
        }
      }
    });
  }

  if (issues.length) {
    throw new PracticeValidationError(issues);
  }

  return input as PracticeCatalog;
};
