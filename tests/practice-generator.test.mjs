import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import {
  generatePracticePackFromCatalog,
  seededShuffle,
} from "../src/lib/practice/generator.ts";
import {
  normalizePracticeResponse,
  scorePracticeItem,
} from "../src/lib/practice/scoring.ts";

const makeItems = () =>
  Array.from({ length: 12 }, (_, index) => {
    const difficulty = (index % 3) + 1;
    const number = String(index + 1).padStart(3, "0");
    const objectiveId = index % 2 ? "u01.questions" : "u01.be-agreement";
    const common = {
      id: `u01.practice.${number}`,
      revision: 1,
      objectiveId,
      difficulty,
      prompt: { en: `Prompt ${number}`, lt: `Užduotis ${number}` },
      rationale: { en: "This is the rule.", lt: "Tai yra taisyklė." },
      sourceRefs: [{ lesson: "unit-01", exercise: 1 }],
    };

    return index % 2 === 0
      ? {
          ...common,
          type: "single-choice",
          choices: [
            { id: "a", text: "am" },
            { id: "b", text: "is" },
            { id: "c", text: "are" },
          ],
          answer: { choiceId: "a" },
        }
      : {
          ...common,
          type: "fill-blank",
          answer: { accepted: ["I'm", "I am"], caseSensitive: false },
        };
  });

const catalog = {
  schemaVersion: 1,
  generatorVersion: 1,
  sourceHash: `sha256-${"1".repeat(64)}`,
  units: [
    {
      schemaVersion: 1,
      unitId: "unit-01",
      contentVersion: 1,
      title: "Unit 1",
      objectives: [
        { id: "u01.be-agreement", label: { en: "Be", lt: "Būti" } },
        { id: "u01.questions", label: { en: "Questions", lt: "Klausimai" } },
      ],
      items: makeItems(),
    },
  ],
};

test("pack generation is byte-for-byte deterministic for the same options", () => {
  const options = { unitId: "unit-01", mode: "standard", count: 8, attempt: 2 };
  const first = generatePracticePackFromCatalog(catalog, options);
  const second = generatePracticePackFromCatalog(catalog, options);

  assert.deepEqual(first, second);
  assert.equal(JSON.stringify(first), JSON.stringify(second));
  assert.equal(new Set(first.items.map((item) => item.id)).size, 8);
});

test("attempt number changes the deterministic session", () => {
  const first = generatePracticePackFromCatalog(catalog, {
    unitId: "unit-01",
    mode: "standard",
    count: 8,
    attempt: 1,
  });
  const next = generatePracticePackFromCatalog(catalog, {
    unitId: "unit-01",
    mode: "standard",
    count: 8,
    attempt: 2,
  });

  assert.notEqual(first.id, next.id);
  assert.notDeepEqual(
    first.items.map((item) => item.id),
    next.items.map((item) => item.id),
  );
});

test("guided practice skews easier than review practice", () => {
  const guided = generatePracticePackFromCatalog(catalog, {
    unitId: "unit-01",
    mode: "guided",
    count: 8,
  });
  const review = generatePracticePackFromCatalog(catalog, {
    unitId: "unit-01",
    mode: "review",
    count: 8,
  });
  const average = (items) =>
    items.reduce((total, item) => total + item.difficulty, 0) / items.length;

  assert.ok(average(guided.items) < average(review.items));
});

test("checkpoint mode is deterministic and uses a balanced harder pattern", () => {
  const standard = generatePracticePackFromCatalog(catalog, {
    unitId: "unit-01",
    mode: "standard",
    count: 8,
  });
  const checkpoint = generatePracticePackFromCatalog(catalog, {
    unitId: "unit-01",
    mode: "checkpoint",
    count: 8,
  });
  const average = (items) =>
    items.reduce((total, item) => total + item.difficulty, 0) / items.length;

  assert.match(checkpoint.id, /\.checkpoint\./);
  assert.ok(average(checkpoint.items) >= average(standard.items));
  assert.deepEqual(
    checkpoint,
    generatePracticePackFromCatalog(catalog, {
      unitId: "unit-01",
      mode: "checkpoint",
      count: 8,
    }),
  );
});

test("recent items are deferred when enough alternatives exist", () => {
  const recentItemIds = makeItems().slice(0, 4).map((item) => item.id);
  const pack = generatePracticePackFromCatalog(catalog, {
    unitId: "unit-01",
    mode: "standard",
    count: 4,
    recentItemIds,
  });

  assert.equal(pack.items.some((item) => recentItemIds.includes(item.id)), false);
});

test("target objectives are strongly preferred and normalized deterministically", () => {
  const options = {
    unitId: "unit-01",
    mode: "standard",
    count: 4,
    targetObjectiveIds: [" u01.questions "],
  };
  const pack = generatePracticePackFromCatalog(catalog, options);

  assert.deepEqual(pack.targetObjectiveIds, ["u01.questions"]);
  assert.ok(pack.items.every((item) => item.objectiveId === "u01.questions"));
  assert.deepEqual(pack, generatePracticePackFromCatalog(catalog, options));
  assert.deepEqual(
    generatePracticePackFromCatalog(catalog, {
      ...options,
      targetObjectiveIds: ["u99.not-in-this-scope"],
    }),
    generatePracticePackFromCatalog(catalog, {
      ...options,
      targetObjectiveIds: [],
    }),
  );
});

test("explicit priority items override recency avoidance", () => {
  const priorityItemId = makeItems()[0].id;
  const pack = generatePracticePackFromCatalog(catalog, {
    unitId: "unit-01",
    mode: "standard",
    count: 1,
    recentItemIds: [priorityItemId],
    priorityItemIds: [priorityItemId],
  });

  assert.equal(pack.items[0].id, priorityItemId);
  assert.deepEqual(pack.priorityItemIds, [priorityItemId]);
});

test("targeting preferences participate in the deterministic pack fingerprint", () => {
  const base = {
    unitId: "unit-01",
    mode: "standard",
    count: 4,
    attempt: 3,
  };
  const questions = generatePracticePackFromCatalog(catalog, {
    ...base,
    targetObjectiveIds: ["u01.questions"],
  });
  const agreement = generatePracticePackFromCatalog(catalog, {
    ...base,
    targetObjectiveIds: ["u01.be-agreement"],
  });

  assert.notEqual(questions.seed, agreement.seed);
  assert.notEqual(questions.id, agreement.id);
  const prioritized = generatePracticePackFromCatalog(catalog, {
    ...base,
    priorityItemIds: ["u01.practice.001"],
  });
  assert.notEqual(prioritized.seed, questions.seed);
  assert.notEqual(prioritized.id, questions.id);
  assert.deepEqual(
    generatePracticePackFromCatalog(catalog, {
      ...base,
      targetObjectiveIds: ["u01.questions", "u01.be-agreement"],
    }),
    generatePracticePackFromCatalog(catalog, {
      ...base,
      targetObjectiveIds: ["u01.be-agreement", "u01.questions"],
    }),
  );
});

test("targeting options reject empty and duplicate IDs", () => {
  const base = { unitId: "unit-01", mode: "standard", count: 4 };

  assert.throws(
    () => generatePracticePackFromCatalog(catalog, {
      ...base,
      targetObjectiveIds: ["u01.questions", "u01.questions"],
    }),
    /targetObjectiveIds must not contain duplicate IDs/,
  );
  assert.throws(
    () => generatePracticePackFromCatalog(catalog, {
      ...base,
      priorityItemIds: ["u01.practice.001", " u01.practice.001 "],
    }),
    /priorityItemIds must not contain duplicate IDs/,
  );
  assert.throws(
    () => generatePracticePackFromCatalog(catalog, {
      ...base,
      targetObjectiveIds: [""],
    }),
    /must be a non-empty string/,
  );
});

test("seeded choice shuffling preserves IDs and the correct answer", () => {
  const original = makeItems()[0];
  const pack = generatePracticePackFromCatalog(catalog, {
    unitId: "unit-01",
    mode: "guided",
    count: 8,
  });
  const generated = pack.items.find((item) => item.id === original.id);

  assert.ok(generated && generated.type === "single-choice");
  assert.deepEqual(
    new Set(generated.choices.map((choice) => choice.id)),
    new Set(original.choices.map((choice) => choice.id)),
  );
  assert.equal(generated.answer.choiceId, original.answer.choiceId);
  assert.deepEqual(seededShuffle([1, 2, 3, 4], "same"), seededShuffle([1, 2, 3, 4], "same"));
});

test("choice and fill-blank scoring is exact but safely normalized", () => {
  const choice = makeItems()[0];
  const gap = makeItems()[1];

  assert.equal(scorePracticeItem(choice, "a").correct, true);
  assert.equal(scorePracticeItem(choice, "am").correct, false);
  assert.equal(scorePracticeItem(gap, "  I’m  ").correct, true);
  assert.equal(scorePracticeItem(gap, "I are").correct, false);
  assert.equal(normalizePracticeResponse("  WE   ARE "), "we are");
});

test("the generator never uses an ambient random source", () => {
  const source = readFileSync(new URL("../src/lib/practice/generator.ts", import.meta.url), "utf8");
  assert.doesNotMatch(source, /Math\.random\s*\(/);
});
