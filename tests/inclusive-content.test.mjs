import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const read = (relativePath) =>
  readFileSync(new URL(`../${relativePath}`, import.meta.url), "utf8");
const readJson = (relativePath) => JSON.parse(read(relativePath));

test("Unit 9 qualifies changing real-world rules and keeps the key aligned", () => {
  const unit = read("unit-09-modal-verbs.md");
  const key = read("answer-key.md");

  assert.match(unit, /Rules depend on the place and can change/);
  assert.match(unit, /check current official guidance and signs/);
  assert.match(unit, /At Mina's workplace, visitors have to sign in/);
  assert.match(unit, /A sign at the hotel says, "No smoking inside,"/);
  assert.match(key, /5\. Smoking inside the hotel/);
  assert.doesNotMatch(unit, /At work, you should be punctual/);
});

test("Unit 10 teaches tense choice through meaning and revises scored practice", () => {
  const unit = read("unit-10-present-tenses-contrast.md");
  const source = readJson("practice/sources/unit-10.json");
  const item = source.items.find((candidate) => candidate.id === "u10.present-continuous.008");

  assert.match(unit, /these expressions are clues, not automatic rules/);
  assert.match(unit, /Exercise 5: Meaning and Context/);
  assert.match(unit, /I started this job in 2020 and I still work here/);
  assert.match(unit, /Decide what the sentence means first/);
  assert.doesNotMatch(unit, /native speakers/i);
  assert.equal(source.contentVersion, 4);
  assert.equal(item?.revision, 2);
  assert.match(item?.prompt.en ?? "", /action is in progress now/);
});

test("Unit 12 uses inclusive partners and two manageable writing rounds", () => {
  const unit = read("unit-12-review-and-consolidation.md");
  const key = read("answer-key.md");

  assert.match(unit, /English-speaking partners/);
  assert.doesNotMatch(unit, /native speakers/i);
  assert.match(unit, /two short rounds of 4–5 sentences/);
  assert.match(unit, /Round A — Everyday life and now/);
  assert.match(unit, /Round B — A past event and a next step/);
  assert.match(key, /Open writing self-check in two short rounds/);
});

test("Unit 24 glosses abstract project language in A2-friendly terms", () => {
  const unit = read("unit-24-a2-communication-project.md");

  for (const term of ["need", "limit", "backup", "trade-off", "evidence", "repair"]) {
    assert.match(unit, new RegExp(`\\*\\*${term}\\*\\*`));
  }
  assert.match(unit, /one advantage and one disadvantage/);
  assert.match(unit, /the dialogue must do all four things: explain, offer, check, and confirm/);
});

test("sensitive Grey chapters provide bilingual notices and a gentler route", () => {
  for (const number of [2, 4, 5, 7, 9, 10, 11]) {
    const chapter = read(`Grey's book/chapter-${String(number).padStart(2, "0")}.md`);
    assert.match(chapter, /Content note \/ Turinio pastaba/);
    assert.match(chapter, /Gentler route \/ Švelnesnis kelias/);
    assert.match(chapter, /\/resources\/grammar-reference#/);
    assert.match(chapter, /Sugrįžkite, kai būsite pasirengę/);
  }
});

test("Chapter 5 treats grief respectfully and permits fictional private answers", () => {
  const chapter = read("Grey's book/chapter-05.md");

  assert.match(chapter, /Crying did not make her weak/);
  assert.match(chapter, /real or fictional supportive person/);
  assert.match(chapter, /You do not need to share private information/);
  assert.match(chapter, /\*Praktikos užduotys \/ Practice activities\*/);
  assert.doesNotMatch(chapter, /like a machine|completely broken|crying like a child|I'm so stupid|Who is your best friend/i);
});

test("study-plan and portfolio prompts protect privacy and never auto-grade reflection", () => {
  const plan = read("a2-30-day-study-plan.md");
  const portfolio = read("a2-can-do-portfolio.md");

  assert.match(plan, /real or imaginary route from a public place/);
  assert.match(plan, /Do not share your home address or another exact private location/);
  assert.match(portfolio, /Self-assessment only \/ Tik įsivertinimui/);
  assert.match(portfolio, /They are never auto-graded/);
  assert.match(portfolio, /Svetainė jų niekada nevertina automatiškai/);
});

test("semantic content changes carry current course revisions", () => {
  const course = readJson("learning/course-path.json");
  const sessions = new Map(course.modules.flatMap((module) => module.sessions).map((session) => [session.id, session]));
  const expected = new Map([
    ["module-02-context", 4],
    ["module-04-context", 3],
    ["module-05-context", 3],
    ["module-07-context", 4],
    ["module-09-context", 4],
    ["module-09-learn", 5],
    ["module-10-context", 4],
    ["module-10-learn", 4],
    ["module-11-context", 3],
    ["module-12-learn", 7],
  ]);

  for (const [id, revision] of expected) {
    assert.equal(sessions.get(id)?.revision, revision, id);
  }
});
