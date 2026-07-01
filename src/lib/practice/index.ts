import rawPracticeCatalog from "../../generated/practice-catalog.json" with { type: "json" };

import {
  generatePracticePackFromCatalog,
  type GeneratePracticePackOptions,
  type PracticePack,
} from "./generator.ts";
import {
  scorePracticeItem as scoreItem,
  type PracticeScoreResult,
} from "./scoring.ts";
import {
  validatePracticeCatalog,
  type BilingualText,
  type FillBlankPracticeItem,
  type PracticeCatalog,
  type PracticeChoice,
  type PracticeDifficulty,
  type PracticeItem,
  type PracticeItemType,
  type PracticeMode,
  type PracticeObjective,
  type PracticeSourceRef,
  type PracticeUnitSource,
  type SingleChoicePracticeItem,
} from "./schema.ts";

export const practiceCatalog: PracticeCatalog = validatePracticeCatalog(
  rawPracticeCatalog,
);

export const getPracticeItems = (unitId: string): readonly PracticeItem[] => {
  const unit = practiceCatalog.units.find((candidate) => candidate.unitId === unitId);

  if (!unit) {
    throw new RangeError(`Unknown practice unit “${unitId}”`);
  }

  return unit.items;
};

export const generatePracticePack = (
  options: GeneratePracticePackOptions,
): PracticePack => generatePracticePackFromCatalog(practiceCatalog, options);

export const scorePracticeItem = (
  item: PracticeItem,
  response: string,
): PracticeScoreResult => scoreItem(item, response);

export {
  DEFAULT_PRACTICE_PACK_SIZE,
  generatePracticePackFromCatalog,
  hashPracticeSeed,
  seededShuffle,
} from "./generator.ts";
export { normalizePracticeResponse } from "./scoring.ts";
export {
  PRACTICE_GENERATOR_VERSION,
  PRACTICE_SCHEMA_VERSION,
  PracticeValidationError,
  validatePracticeCatalog,
  validatePracticeSource,
} from "./schema.ts";

export type {
  BilingualText,
  FillBlankPracticeItem,
  GeneratePracticePackOptions,
  PracticeCatalog,
  PracticeChoice,
  PracticeDifficulty,
  PracticeItem,
  PracticeItemType,
  PracticeMode,
  PracticeObjective,
  PracticePack,
  PracticeScoreResult,
  PracticeSourceRef,
  PracticeUnitSource,
  SingleChoicePracticeItem,
};
