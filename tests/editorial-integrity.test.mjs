import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const read = (relativePath) =>
  readFileSync(new URL(`../${relativePath}`, import.meta.url), "utf8");

const answerKey = read("answer-key.md");
const keySection = (unit, nextUnit) => {
  const start = answerKey.indexOf(`## Unit ${unit}:`);
  const end = nextUnit ? answerKey.indexOf(`## Unit ${nextUnit}:`, start) : answerKey.length;
  return answerKey.slice(start, end);
};

const localSection = (source, heading, nextHeading) => {
  const start = source.indexOf(heading);
  assert.notEqual(start, -1, `missing heading: ${heading}`);
  const end = nextHeading ? source.indexOf(nextHeading, start + heading.length) : source.length;
  assert.notEqual(end, -1, `missing following heading: ${nextHeading}`);
  return source.slice(start, end);
};

test("high-risk A2 answers are supported by their lesson evidence", () => {
  const unit8 = read("unit-08-comparatives-and-superlatives.md");
  const unit9 = read("unit-09-modal-verbs.md");
  const unit20 = read("unit-20-invitations-and-social-plans.md");
  const unit9Exercise6Key = keySection(9, 10)
    .split("### Exercise 6: Problem-Solving Scenarios")[1]
    .split("### Exercise 7: Reading Comprehension")[0];

  assert.match(unit8, /has more listed parks than Klaipėda/);
  assert.match(unit8, /Which city has more listed parks than Klaipėda\?/);
  assert.match(keySection(8, 9), /Kaunas; the travel guide lists more parks there than in Klaipėda/);

  assert.match(unit9, /brother stays up late every night/);
  assert.match(unit9Exercise6Key, /shouldn't stay up so late/);
  assert.doesNotMatch(unit9Exercise6Key, /shouldn't work so late/);

  assert.match(unit20, /Ana is free on Saturday from 12:00 to 17:00/);
  assert.match(unit20, /Mantas is free after 14:00/);
  assert.match(keySection(20, 21), /shared 14:00–17:00 window/);
});

test("Unit 24 repair evidence, word count, and mission budget are self-contained", () => {
  const unit24 = read("unit-24-a2-communication-project.md");
  const mission24 = read("speaking/mission-24-host-a-weekend.md");
  const model = unit24.match(/\*\*Model short message:\*\* \*([^*]+)\* \((\d+) words\)/);

  assert.match(unit24, /Hostel \(2 km from the station\)/);
  assert.match(unit24, /I have book a table at a vegetarian café/);
  assert.match(keySection(24), /hostel is too far away to walk/);
  assert.match(keySection(24), /I have booked a table at a vegetarian café/);
  assert.ok(model, "Unit 24 short-message model is missing");
  assert.equal(model[1].trim().split(/\s+/).length, Number(model[2]));
  assert.equal(Number(model[2]), 28);

  for (const price of ["€3", "€18", "€32", "€55", "€12", "€10", "€25"]) {
    assert.match(mission24, new RegExp(price));
  }
  assert.match(mission24, /full weekend budget is \*\*€90\*\*/);
  assert.match(mission24, /total is €70: €3 for transport, €32 for the hostel, €25 for food, and €10 for the museum/);
});

test("open assessment and first-conditional progression metadata stay aligned", () => {
  const unit6 = read("unit-06-future-plans.md");
  const unit12 = read("unit-12-review-and-consolidation.md");
  const coursePath = JSON.parse(read("learning/course-path.json"));
  const module6Learn = coursePath.modules
    .find((module) => module.id === "module-06")
    .sessions.find((session) => session.stage === "learn");
  const module12Review = coursePath.modules
    .find((module) => module.id === "module-12")
    .sessions.find((session) => session.stage === "review");

  assert.match(unit6, /First conditional \(introduction\)/);
  assert.match(unit6, /Unit 21 returns to the first conditional/);
  assert.ok(module6Learn.skillRefs.includes("conditional.first"));

  assert.match(unit12, /### Test 3: Writing Self-Check/);
  assert.match(unit12, /Do not auto-grade it or turn the checklist into a point score/);
  assert.match(unit12, /\*\*Round A model:\*\*/);
  assert.match(unit12, /\*\*Round B model:\*\*/);
  assert.match(unit12, /\*\*Round A starters:\*\*/);
  assert.match(unit12, /\*\*Round B starters:\*\*/);
  assert.match(keySection(12, 13), /Do not auto-grade this task or assign a point total/);
  assert.equal(module12Review.revision, 2);
});

test("Grey's Book modal advice and final-chapter chronology remain coherent", () => {
  const chapter3 = read("Grey's book/chapter-03.md");
  const chapter12 = read("Grey's book/chapter-12.md");
  const greyAnswers = read("Grey's book/answers.md");

  assert.match(chapter3, /We ______ tell Dr\. Webber about the work conflict/);
  assert.doesNotMatch(chapter3, /must \/ might \/ should/);
  assert.match(greyAnswers, /must — they need to report the work conflict/);

  const beforeCare = chapter12.indexOf("Before they began");
  const noon = chapter12.indexOf("At noon");
  const completed = chapter12.indexOf("By late afternoon");
  assert.ok(beforeCare > -1 && beforeCare < noon);
  assert.ok(noon < completed);
});

test("the workplace repair key keeps the required object", () => {
  const workplace = read("a2-workplace-english-pack.md");
  assert.match(workplace, /I have already told the team/);
  assert.doesNotMatch(workplace, /\*I have already told\.\*/);
});

test("Lithuanian time-word and learner-support glosses remain natural", () => {
  const unit7 = read("unit-07-present-perfect-introduction.md");
  const unit11 = read("unit-11-past-continuous.md");
  const unit12 = read("unit-12-review-and-consolidation.md");
  const vocabulary = read("vocabulary-lists.md");
  const grey1 = read("Grey's book/chapter-01.md");

  assert.match(unit7, /I haven't finished yet<\/em> - <strong>Dar nebaigiau<\/strong>/);
  assert.match(unit7, /Have you finished yet\?<\/em> - <strong>Ar jau baigei\?<\/strong>/);
  assert.match(unit7, /for two years\* - dvejus metus/);
  assert.doesNotMatch(unit7, /yet - dar \(neiginiuose sakiniuose ir klausimuose\)/i);

  assert.match(unit11, /all day yesterday - visą vakarykštę dieną/);
  assert.doesNotMatch(unit11, /vakardieną/);
  assert.match(unit12, /Kalbėjau užbaigtais sakiniais/);
  assert.doesNotMatch(unit12, /pilnais sakiniais/);
  assert.match(vocabulary, /nervous - nerimaujantis, įsitempęs/);
  assert.match(grey1, /nervous — nerimaujantis \/ nerimaujanti/);
});

test("Unit 8 accepts standard variants and labels opinions as opinions", () => {
  const unit8 = read("unit-08-comparatives-and-superlatives.md");
  const unit8Key = keySection(8, 9);

  assert.match(unit8Key, /5\. the farthest\/furthest/);
  assert.match(unit8, /In your opinion, is Vilnius/);
  assert.match(unit8, /According to this price report/);
  assert.match(unit8, /A class in Vilnius discussed local food/);
  assert.match(unit8, /received the most votes as a favourite/);
  assert.doesNotMatch(unit8, /Lithuanian food is very good and healthy/);
  assert.doesNotMatch(unit8, /People think cepelinai are the best/);
});

test("Unit 9 deductions use evidence and health tasks avoid diagnosis", () => {
  const unit9 = read("unit-09-modal-verbs.md");
  const unit9Key = keySection(9, 10);

  assert.doesNotMatch(unit9, /new car\. He must be rich/);
  assert.doesNotMatch(unit9, /won the competition\. She _____ be happy/);
  assert.match(unit9, /smiling, cheering, and saying, "I did it!"/);
  assert.match(unit9, /Do not diagnose the cause/);
  assert.match(unit9, /doctor or nurse/);
  assert.match(unit9, /shouldn't delay professional advice because she is busy/);
  assert.doesNotMatch(unit9, /You should take some medicine/);
  assert.match(unit9Key, /One safe completion:/);
  assert.doesNotMatch(unit9Key, /It \*\*may\/might\*\* be serious/);
});

test("Unit 11 forces the intended tense and answers location before activity", () => {
  const unit11 = read("unit-11-past-continuous.md");
  const unit11Key = keySection(11, 12);

  assert.match(unit11, /Two drivers were trying to park their cars/);
  assert.match(unit11, /What were the two drivers doing\?/);
  assert.match(unit11, /At 8 p\.m\. last night, she was study English/);
  assert.match(unit11Key, /At 8 p\.m\. last night, she was studying English/);
  assert.match(unit11, /I was at the shopping mall\. I _____ \(shop\) for clothes/);
});

test("Unit 22 explains degree and complaint order without literal Lithuanian", () => {
  const unit22 = read("unit-22-services-and-problem-solving.md");
  const unit22Key = keySection(22, 23);

  assert.match(unit22, /greet → describe the purchase and problem → give evidence → request a solution/);
  assert.match(unit22, /<strong>too small<\/strong> - <strong>per mažas<\/strong>/);
  assert.doesNotMatch(unit22, /reiškia „per daug“: <strong>too small<\/strong>/);
  assert.match(unit22Key, /The company has sent part C by express delivery/);
});

test("grammar reference covers the later A2 progression", () => {
  const grammar = read("grammar-reference.md");
  const requiredHeadings = [
    "## Determiners: One and Ones",
    "## Pronouns: Object, Possessive, and Reflexive",
    "## Verb Patterns and Purpose",
    "## Adverbs, Imperatives, and Sequence Words",
    "## Suggestions: Let's and How about",
    "## First Conditional",
    "## Reasons and Results: Because and So",
    "## Less and Fewer",
    "## Too and Enough",
    "## Defining Relative Clauses",
  ];

  for (const heading of requiredHeadings) {
    assert.ok(grammar.includes(heading), `missing grammar-reference section: ${heading}`);
  }

  assert.match(grammar, /\[Suggestions: Let's and How about\]\(#suggestions-let-s-and-how-about\)/);
  assert.match(grammar, /The white \*\*one\*\*/);
  assert.match(grammar, /Call her\. Come with us\./);
  assert.match(grammar, /I practise speaking \*\*to improve\*\* my English/);
  assert.match(grammar, /Don't share your password/);
  assert.match(grammar, /\*Let's meet\* ✓/);
  assert.match(grammar, /If it \*\*rains\*\*, we \*\*will stay\*\* home/);
  assert.match(grammar, /Use \*\*because\*\* before a reason and \*\*so\*\* before a result/);
  assert.match(grammar, /less water, fewer bottles/);
  assert.match(grammar, /too small – per mažas/);
  assert.match(grammar, /a guide \*\*who speaks English\*\*/);
});

test("grammar reference chooses tense and future forms by meaning", () => {
  const grammar = read("grammar-reference.md");

  assert.match(grammar, /it is not an exhaustive grammar of English/);
  assert.doesNotMatch(grammar, /Complete grammar reference for Lithuanian speakers/);
  assert.match(grammar, /Choose by meaning, not only by whether a time phrase is written/);
  assert.match(grammar, /I saw that film, but I don't remember when/);
  assert.match(grammar, /Present Perfect is not normally used with a finished past expression/);
  assert.match(grammar, /certainty do not decide the form by themselves/);
  assert.match(grammar, /an intention that exists before speaking/);
  assert.match(grammar, /a decision made while speaking/);
  assert.doesNotMatch(grammar, /\| Planned future \| Unplanned\/spontaneous \|/);
});

test("grammar reference presents modal differences as tendencies", () => {
  const grammar = read("grammar-reference.md");

  assert.match(grammar, /often sounds softer or less direct than \*\*Can you help me\?\*\*/);
  assert.match(grammar, /Tone, context, and \*\*please\*\* also affect politeness/);
  assert.match(grammar, /\*\*Must\*\* and \*\*have to\*\* often overlap/);
  assert.match(grammar, /These are tendencies, not absolute differences/);
  assert.match(grammar, /Use \*\*had to\*\* for past obligation and \*\*will have to\*\* for future obligation/);
  assert.doesNotMatch(grammar, /\(internal obligation\)/);
  assert.doesNotMatch(grammar, /\(rule\/law\)/);
});

test("R066-R072 open tasks provide local A2 scaffolds and current revisions", () => {
  const targets = [
    ["unit-01-greetings-and-introductions.md", "### Activity 4: Speed Introductions", "### Activity 5: Cultural Exchange"],
    ["unit-01-greetings-and-introductions.md", "### Activity 5: Cultural Exchange", "### Activity 6: Pronunciation Practice"],
    ["unit-02-daily-routines.md", "### Activity 2: Time Management Discussion", "### Activity 3: Cultural Routines"],
    ["unit-02-daily-routines.md", "### Activity 4: Role-Play - Daily Schedule", "## Additional Cultural Notes"],
    ["unit-03-past-simple.md", "### Activity 2: Memory Game", "### Activity 3: Role-Play - Time Travel"],
    ["unit-03-past-simple.md", "### Activity 3: Role-Play - Time Travel", "## Additional Cultural Notes"],
    ["unit-04-food-and-shopping.md", "## Exercise 8: Write your shopping list", "## Exercise 9: Translation"],
    ["unit-04-food-and-shopping.md", "### Activity 3: Cultural Food Exchange", "## Additional Cultural Notes"],
    ["unit-05-travel-and-directions.md", "### Activity 1: Directions Game", "### Activity 2: Travel Stories"],
    ["unit-05-travel-and-directions.md", "### Activity 2: Travel Stories", "### Activity 3: Transportation Debate"],
    ["unit-05-travel-and-directions.md", "### Activity 3: Transportation Debate", "## Additional Cultural Notes"],
    ["unit-06-future-plans.md", "### Activity 2: Goal Sharing", "### Activity 3: Dream Job Interview"],
    ["unit-06-future-plans.md", "### Activity 3: Dream Job Interview", "## Additional Cultural Notes"],
    ["unit-10-present-tenses-contrast.md", "### Activity 2: Current vs Habit", "### Activity 3: Experience Sharing"],
    ["unit-10-present-tenses-contrast.md", "### Activity 3: Experience Sharing", "## Additional Cultural Notes"],
  ];

  for (const [file, heading, nextHeading] of targets) {
    const section = localSection(read(file), heading, nextHeading);
    assert.match(section, /\*\*(?:Model|20-second model|Model opening|Model list|Sentence starters|Planning frame|Interview starters|Self-check|Success checklist)/, `${heading} lacks a local scaffold`);
    assert.doesNotMatch(section, /auto-grade|point total/i);
  }

  const unit5Comparison = localSection(
    read("unit-05-travel-and-directions.md"),
    "### Activity 3: Transportation Debate",
    "## Additional Cultural Notes",
  );
  assert.match(unit5Comparison, /Unit 8 teaches comparative adjective forms/);
  assert.match(unit5Comparison, /I prefer\.\.\. because/);

  const coursePath = JSON.parse(read("learning/course-path.json"));
  const expectedRevisions = new Map([
    ["module-01", 3], ["module-02", 3], ["module-03", 3],
    ["module-04", 4], ["module-05", 4], ["module-06", 5], ["module-10", 4],
  ]);
  for (const [moduleId, revision] of expectedRevisions) {
    const learn = coursePath.modules
      .find((module) => module.id === moduleId)
      .sessions.find((session) => session.stage === "learn");
    assert.equal(learn.revision, revision);
  }
});
