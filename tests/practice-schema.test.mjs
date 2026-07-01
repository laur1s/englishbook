import assert from "node:assert/strict";
import test from "node:test";

import {
  PRACTICE_GENERATOR_VERSION,
  PracticeValidationError,
  validatePracticeCatalog,
  validatePracticeSource,
} from "../src/lib/practice/schema.ts";

const makeItem = (index) => {
  const id = String(index + 1).padStart(3, "0");

  if (index % 2 === 0) {
    return {
      id: `u01.be-agreement.${id}`,
      revision: 1,
      objectiveId: "u01.be-agreement",
      type: "single-choice",
      difficulty: index % 3 + 1,
      prompt: { en: `I ___ ready. (${id})`, lt: `Aš ___ pasiruošęs. (${id})` },
      choices: [
        { id: "am", text: "am" },
        { id: "is", text: "is" },
        { id: "are", text: "are" },
      ],
      answer: { choiceId: "am" },
      rationale: { en: "Use am with I.", lt: "Su I vartojame am." },
      sourceRefs: [{ lesson: "unit-01", exercise: 1 }],
    };
  }

  return {
    id: `u01.be-agreement.${id}`,
    revision: 1,
    objectiveId: "u01.be-agreement",
    type: "fill-blank",
    difficulty: index % 3 + 1,
    prompt: { en: `She ___ ready. (${id})`, lt: `Ji ___ pasiruošusi. (${id})` },
    answer: { accepted: ["is"], caseSensitive: false },
    rationale: { en: "Use is with she.", lt: "Su she vartojame is." },
    sourceRefs: [{ lesson: "unit-01", exercise: 1 }],
  };
};

const makeSource = () => ({
  schemaVersion: 1,
  unitId: "unit-01",
  contentVersion: 1,
  title: "Unit 1",
  objectives: [
    {
      id: "u01.be-agreement",
      label: { en: "Use be forms", lt: "Vartoti be formas" },
    },
  ],
  items: Array.from({ length: 16 }, (_, index) => makeItem(index)),
});

const makeCatalog = () => ({
  schemaVersion: 1,
  generatorVersion: PRACTICE_GENERATOR_VERSION,
  sourceHash: `sha256-${"0".repeat(64)}`,
  units: Array.from({ length: 24 }, (_, index) => {
    const unitNumber = String(index + 1).padStart(2, "0");
    const source = structuredClone(makeSource());
    source.unitId = `unit-${unitNumber}`;
    source.title = `Unit ${index + 1}`;
    source.objectives.forEach((objective) => {
      objective.id = objective.id.replace("u01.", `u${unitNumber}.`);
    });
    source.items.forEach((item) => {
      item.id = item.id.replace("u01.", `u${unitNumber}.`);
      item.objectiveId = item.objectiveId.replace("u01.", `u${unitNumber}.`);
      item.sourceRefs.forEach((sourceRef) => {
        sourceRef.lesson = `unit-${unitNumber}`;
      });
    });
    return source;
  }),
});

test("a complete bilingual practice source validates", () => {
  const source = makeSource();
  assert.equal(validatePracticeSource(source), source);
});

test("choice answers must reference a real choice", () => {
  const source = makeSource();
  source.items[0].answer.choiceId = "missing";

  assert.throws(
    () => validatePracticeSource(source),
    (error) =>
      error instanceof PracticeValidationError &&
      error.issues.some((issue) => issue.includes("must reference one of the item choices")),
  );
});

test("items require bilingual rationales and stable unique IDs", () => {
  const source = makeSource();
  source.items[1].rationale.lt = "";
  source.items[2].id = source.items[1].id;

  assert.throws(
    () => validatePracticeSource(source),
    (error) =>
      error instanceof PracticeValidationError &&
      error.issues.some((issue) => issue.includes("rationale.lt")) &&
      error.issues.some((issue) => issue.includes("duplicate item ID")),
  );
});

test("catalog validation accepts the exact generator and ordered 24-unit shape", () => {
  const catalog = makeCatalog();
  assert.equal(validatePracticeCatalog(catalog), catalog);
});

test("catalog validation requires the exact generator version", () => {
  const catalog = makeCatalog();
  catalog.generatorVersion = PRACTICE_GENERATOR_VERSION + 1;

  assert.throws(
    () => validatePracticeCatalog(catalog),
    (error) =>
      error instanceof PracticeValidationError &&
      error.issues.some((issue) => issue.includes(`must equal ${PRACTICE_GENERATOR_VERSION}`)),
  );
});

test("catalog validation requires all 24 units in canonical order", () => {
  const incomplete = makeCatalog();
  incomplete.units.pop();
  assert.throws(
    () => validatePracticeCatalog(incomplete),
    (error) =>
      error instanceof PracticeValidationError &&
      error.issues.some((issue) => issue.includes("exactly 24 ordered units")),
  );

  const reordered = makeCatalog();
  [reordered.units[0], reordered.units[1]] = [reordered.units[1], reordered.units[0]];
  assert.throws(
    () => validatePracticeCatalog(reordered),
    (error) =>
      error instanceof PracticeValidationError &&
      error.issues.some((issue) =>
        issue.includes("practice catalog.units[0].unitId: must equal unit-01")
      ),
  );
});
