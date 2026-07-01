import assert from "node:assert/strict";
import test from "node:test";

import {
  generatePracticePack,
  getPracticeItems,
  practiceCatalog,
  scorePracticeItem,
} from "../src/lib/practice/index.ts";
import { checkPracticeCatalog } from "../scripts/check-practice.mjs";

test("compiled catalog covers all twelve units with usable banks", () => {
  assert.equal(practiceCatalog.units.length, 12);

  const allItemIds = new Set();

  practiceCatalog.units.forEach((unit, index) => {
    assert.equal(unit.unitId, `unit-${String(index + 1).padStart(2, "0")}`);
    assert.ok(unit.items.length >= 10, `${unit.unitId} needs at least ten items`);
    assert.ok(unit.items.some((item) => item.type === "single-choice"));
    assert.ok(unit.items.some((item) => item.type === "fill-blank"));

    unit.items.forEach((item) => {
      assert.equal(allItemIds.has(item.id), false, `duplicate ${item.id}`);
      allItemIds.add(item.id);
      assert.ok(item.rationale.en.trim());
      assert.ok(item.rationale.lt.trim());
      assert.ok(item.sourceRefs.length > 0);
    });
  });
});

test("the UI-facing item and pack APIs work for every mode", () => {
  assert.ok(getPracticeItems("unit-01").length >= 8);
  assert.throws(() => getPracticeItems("unit-99"), RangeError);

  for (const mode of ["guided", "standard", "review", "checkpoint"]) {
    const pack = generatePracticePack({
      unitId: "unit-12",
      mode,
      count: 8,
      attempt: 3,
    });

    assert.equal(pack.mode, mode);
    assert.equal(pack.items.length, 8);
    assert.equal(new Set(pack.items.map((item) => item.id)).size, 8);
  }
});

test("every unit can supply ten-item standard and checkpoint sessions", () => {
  for (const unit of practiceCatalog.units) {
    for (const mode of ["standard", "checkpoint"]) {
      const pack = generatePracticePack({
        unitId: unit.unitId,
        mode,
        count: 10,
        attempt: 1,
      });

      assert.equal(pack.items.length, 10);
      assert.equal(new Set(pack.items.map((item) => item.id)).size, 10);
    }
  }
});

const unitRange = (start, end) =>
  Array.from(
    { length: end - start + 1 },
    (_, index) => `unit-${String(start + index).padStart(2, "0")}`,
  );

for (const [label, unitIds, count] of [
  ["Units 1–3", unitRange(1, 3), 9],
  ["Units 1–6", unitRange(1, 6), 12],
  ["Units 7–9", unitRange(7, 9), 9],
  ["Units 1–12", unitRange(1, 12), 24],
]) {
  test(`${label} produce one deterministic round-robin checkpoint`, () => {
    const options = {
      unitIds,
      mode: "checkpoint",
      count,
      attempt: 4,
    };
    const first = generatePracticePack(options);
    const again = generatePracticePack(options);
    const reversedInput = generatePracticePack({
      ...options,
      unitIds: [...unitIds].reverse(),
    });

    assert.deepEqual(first, again);
    assert.deepEqual(first, reversedInput);
    assert.equal(first.unitId, null);
    assert.equal(first.contentVersion, null);
    assert.deepEqual(first.unitIds, unitIds);
    assert.equal(new Set(first.items.map((item) => item.id)).size, count);

    const counts = new Map(unitIds.map((unitId) => [unitId, 0]));

    first.items.forEach((item) => {
      const sourceUnit = item.sourceRefs[0].lesson;
      assert.ok(counts.has(sourceUnit), `${item.id} came from outside the requested pool`);
      counts.set(sourceUnit, counts.get(sourceUnit) + 1);

      if (item.type === "single-choice") {
        assert.ok(item.choices.some((choice) => choice.id === item.answer.choiceId));
      }
    });

    const perUnit = [...counts.values()];
    assert.ok(Math.max(...perUnit) - Math.min(...perUnit) <= 1);
  });
}

test("multi-unit options reject empty, duplicate, or conflicting unit scopes", () => {
  assert.throws(
    () => generatePracticePack({ unitIds: [], mode: "checkpoint" }),
    /at least one unit ID/,
  );
  assert.throws(
    () =>
      generatePracticePack({
        unitIds: ["unit-01", "unit-01"],
        mode: "checkpoint",
      }),
    /duplicate unit IDs/,
  );
  assert.throws(
    () =>
      generatePracticePack({
        unitId: "unit-01",
        unitIds: ["unit-02"],
        mode: "checkpoint",
      }),
    /exactly one/,
  );
});

test("source-dependent reviewed items include their context in the prompt", () => {
  const selfContainedIds = [
    "u01.personal-details.009",
    "u01.personal-details.010",
    "u02.routine-reading.008",
    "u02.routine-reading.009",
    "u03.life-story.008",
    "u03.life-story.009",
    "u04.shopping-reading.010",
    "u05.directions.008",
    "u05.travel-reading.009",
    "u06.weekend-reading.010",
    "u11.background.010",
    "u12.functional-review.007",
    "u12.functional-review.010",
  ];
  const itemMap = new Map(
    practiceCatalog.units.flatMap((unit) => unit.items).map((item) => [item.id, item]),
  );

  selfContainedIds.forEach((id) => {
    const item = itemMap.get(id);
    assert.ok(item, `missing reviewed item ${id}`);
    assert.equal(item.revision, 2);
    assert.doesNotMatch(item.prompt.en, /according to|exercise \d/i);
    assert.doesNotMatch(item.prompt.lt, /pagal \d|pratimo tekst/i);
  });
});

test("reviewed Unit 12 life-experience item belongs to tense review", () => {
  const item = getPracticeItems("unit-12").find(
    (candidate) => candidate.id === "u12.functional-review.008",
  );
  assert.equal(item?.objectiveId, "u12.tense-review");
});

test("the UI-facing scorer returns rationale and expected answers", () => {
  const item = getPracticeItems("unit-07").find(
    (candidate) => candidate.type === "fill-blank",
  );
  assert.ok(item && item.type === "fill-blank");

  const result = scorePracticeItem(item, item.answer.accepted[0]);
  assert.equal(result.correct, true);
  assert.deepEqual(result.expected, item.answer.accepted);
  assert.equal(result.rationale.en, item.rationale.en);
});

test("the committed catalog is byte-for-byte current", () => {
  const result = checkPracticeCatalog();
  assert.equal(result.catalog.units.length, 12);
  assert.ok(result.itemCount >= 96);
});
