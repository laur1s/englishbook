import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const read = (relativePath) =>
  readFileSync(new URL(`../${relativePath}`, import.meta.url), "utf8");
const readJson = (relativePath) => JSON.parse(read(relativePath));

const answerKey = read("answer-key.md");
const keySection = (unit, nextUnit) => {
  const start = answerKey.indexOf(`## Unit ${unit}:`);
  const end = nextUnit ? answerKey.indexOf(`## Unit ${nextUnit}:`, start) : answerKey.length;
  return answerKey.slice(start, end);
};

test("Grey chapters keep untaught Past Perfect out of the A2 reading track", () => {
  const chapters = [2, 6, 7, 8, 9, 10, 12].map((number) =>
    read(`Grey's book/chapter-${String(number).padStart(2, "0")}.md`),
  );
  const combined = chapters.join("\n");
  const removedForms = [
    "had brought in",
    "had never met",
    "had not grown up",
    "had recently retired",
    "had gone well",
    "had become separated",
    "had become kinder",
    "had made a small mistake",
    "had Meredith been working",
    "had Alex changed",
    "had given the team",
    "had spent years",
    "had Lily injured",
    "had not charged",
    "had not seen",
    "had not followed",
    "had still succeeded",
  ];

  for (const form of removedForms) {
    assert.equal(combined.toLowerCase().includes(form.toLowerCase()), false, form);
  }

  assert.match(chapters[0], /Paramedics brought in a young woman/);
  assert.match(chapters[3], /Earlier that morning, he made a small mistake/);
  assert.match(chapters[5], /Before this visit, she spent years traveling/);
  assert.match(chapters[6], /one cool-box battery did not charge overnight/);
});

test("course revisions invalidate changed content while Chapter 10 metadata matches its A2 focus", () => {
  const coursePath = readJson("learning/course-path.json");
  const session = (id) => coursePath.modules
    .flatMap((module) => module.sessions)
    .find((candidate) => candidate.id === id);

  for (const [id, revision] of [
    ["module-02-context", 4],
    ["module-06-context", 3],
    ["module-07-context", 4],
    ["module-08-context", 3],
    ["module-09-context", 4],
    ["module-10-context", 4],
    ["module-12-context", 4],
    ["module-04-learn", 4],
    ["module-05-learn", 4],
    ["module-06-learn", 5],
  ]) {
    assert.equal(session(id)?.revision, revision, id);
  }
  assert.ok(session("module-12-learn")?.revision >= 6);
  assert.deepEqual(session("module-10-context")?.skillRefs, [
    "reading.event-order",
    "vocabulary.volunteering",
    "past-simple.events",
    "linking.because-so",
  ]);
  assert.doesNotMatch(session("module-10-context")?.title ?? "", /clues/i);
});

test("Unit 4 fixes countability and some/any meaning with explicit context", () => {
  const unit4 = read("unit-04-food-and-shopping.md");
  const unit4Key = keySection(4, 5);

  assert.match(unit4, /coffee as a drink in a pot/);
  assert.match(unit4, /I am offering you sugar\. Do you want _______ sugar/);
  assert.match(unit4Key, /coffee as the drink in a pot/);
  assert.match(unit4Key, /some \(the speaker is offering sugar\)/);
});

test("Unit 5 accepts natural place and there-no alternatives in lesson and scored practice", () => {
  const unit5 = read("unit-05-travel-and-directions.md");
  const unit5Key = keySection(5, 6);
  const source = readJson("practice/sources/unit-05.json");
  const catalog = readJson("src/generated/practice-catalog.json");
  const sourceItem = source.items.find((item) => item.id === "u05.place-prepositions.001");
  const catalogItem = catalog.units
    .find((unit) => unit.unitId === "unit-05")
    ?.items.find((item) => item.id === sourceItem?.id);

  assert.match(unit5, /There is no.*hospital near here/);
  assert.match(unit5, /There are no.*buses on Sunday/);
  assert.match(unit5Key, /next to \/ beside \/ by/);
  assert.match(unit5Key, /There is no bank here/);
  assert.match(unit5Key, /There are no shops on this street/);
  assert.equal(sourceItem?.revision, 2);
  assert.deepEqual(sourceItem?.answer.accepted, ["next to", "beside", "by"]);
  assert.deepEqual(
    [...(catalogItem?.answer.accepted ?? [])].sort(),
    [...(sourceItem?.answer.accepted ?? [])].sort(),
  );
});

test("Unit 6 plan dialogue records each natural future alternative", () => {
  const unit6 = read("unit-06-future-plans.md");
  const unit6Key = keySection(6, 7);

  assert.match(unit6, /Present Continuous is also possible for a fixed arrangement/);
  assert.match(unit6, /may\/might.*uncertain possibility/);
  assert.match(unit6Key, /are \.\.\. going to do \/ are \.\.\. doing/);
  assert.match(unit6Key, /will watch \/ may watch \/ might watch/);
  assert.match(unit6Key, /are going to leave \/ are leaving/);
});

test("Unit 12 fixes the tense context and constrains the comparison repair", () => {
  const unit12 = read("unit-12-review-and-consolidation.md");
  const unit12Key = keySection(12, 13);
  const source = readJson("practice/sources/unit-12.json");
  const catalog = readJson("src/generated/practice-catalog.json");
  const sourceItem = source.items.find((item) => item.id === "u12.structure-review.013");
  const catalogItem = catalog.units
    .find((unit) => unit.unitId === "unit-12")
    ?.items.find((item) => item.id === sourceItem?.id);

  assert.match(unit12, /Compare the two sisters/);
  assert.match(unit12, /Yesterday, she _____ \(study\) when I _____ \(arrive\)\. She usually/);
  assert.match(unit12Key, /time words fix the past background event and the usual routine/);
  assert.equal(sourceItem?.revision, 2);
  assert.match(sourceItem?.prompt.en ?? "", /Compare the two sisters/);
  assert.equal(catalogItem?.revision, 2);
  assert.equal(catalogItem?.prompt.en, sourceItem?.prompt.en);
});
