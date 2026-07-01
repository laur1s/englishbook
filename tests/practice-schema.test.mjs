import assert from "node:assert/strict";
import test from "node:test";

import {
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
  items: Array.from({ length: 10 }, (_, index) => makeItem(index)),
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

test("catalog validation rejects duplicate global item IDs", () => {
  const first = makeSource();
  const second = structuredClone(first);
  second.unitId = "unit-02";
  second.title = "Unit 2";
  second.objectives[0].id = "u02.be-agreement";
  second.items.forEach((item) => {
    item.objectiveId = "u02.be-agreement";
    item.sourceRefs[0].lesson = "unit-02";
    item.id = item.id.replace("u01.", "u02.");
  });
  second.items[0].id = first.items[0].id;

  assert.throws(
    () =>
      validatePracticeCatalog({
        schemaVersion: 1,
        generatorVersion: 1,
        sourceHash: `sha256-${"0".repeat(64)}`,
        units: [first, second],
      }),
    PracticeValidationError,
  );
});
