import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import {
  generatePracticePack,
  getPracticeItems,
  practiceCatalog,
  scorePracticeItem,
} from "../src/lib/practice/index.ts";
import { checkPracticeCatalog } from "../scripts/check-practice.mjs";

test("compiled catalog covers all twenty-four units with usable banks", () => {
  assert.equal(practiceCatalog.units.length, 24);

  const allItemIds = new Set();

  practiceCatalog.units.forEach((unit, index) => {
    assert.equal(unit.unitId, `unit-${String(index + 1).padStart(2, "0")}`);
    const extendedUnit = index >= 12;
    assert.ok(unit.items.length >= (extendedUnit ? 10 : 16), `${unit.unitId} needs a usable item bank`);
    assert.ok(
      unit.items.filter((item) => item.type === "single-choice").length >= (extendedUnit ? 5 : 6),
      `${unit.unitId} needs a balanced choice bank`,
    );
    assert.ok(
      unit.items.filter((item) => item.type === "fill-blank").length >= (extendedUnit ? 5 : 6),
      `${unit.unitId} needs a balanced fill-blank bank`,
    );

    for (const difficulty of [1, 2, 3]) {
      assert.ok(
        unit.items.filter((item) => item.difficulty === difficulty).length >= (extendedUnit ? 2 : 4),
        `${unit.unitId} needs balanced difficulty-${difficulty} items`,
      );
    }

    unit.objectives.forEach((objective) => {
      assert.ok(
        unit.items.filter((item) => item.objectiveId === objective.id).length >= 3,
        `${unit.unitId} objective ${objective.id} is under-represented`,
      );
    });

    unit.items.forEach((item) => {
      assert.equal(allItemIds.has(item.id), false, `duplicate ${item.id}`);
      allItemIds.add(item.id);
      assert.ok(item.rationale.en.trim());
      assert.ok(item.rationale.lt.trim());
      assert.ok(item.sourceRefs.length > 0);
      assert.doesNotMatch(item.prompt.en, /according to|exercise \d+ text/i);
      assert.doesNotMatch(item.prompt.lt, /pagal \d+|pratimo tekst/i);
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

test("new attempts rotate real item content rather than only its order", () => {
  for (const unit of practiceCatalog.units) {
    const attempts = [1, 2, 3].map((attempt) =>
      generatePracticePack({
        unitId: unit.unitId,
        mode: "standard",
        count: 10,
        attempt,
      }),
    );
    const representedItems = new Set(
      attempts.flatMap((pack) => pack.items.map((item) => item.id)),
    );

    if (unit.items.length === 10) {
      assert.equal(representedItems.size, 10, `${unit.unitId} should use its complete bank`);
    } else {
      assert.ok(representedItems.size > 10, `${unit.unitId} should rotate item content`);
    }
  }
});

const coursePath = JSON.parse(readFileSync(
  new URL("../learning/course-path.json", import.meta.url),
  "utf8",
));
const checkpointConfigurations = coursePath.modules.flatMap((module) =>
  module.sessions
    .filter((session) => session.mode === "checkpoint")
    .map((session) => ({
      sessionId: session.id,
      unitIds: session.unitIds,
      count: session.count,
    }))
);

test("the configured course exposes all eight cumulative checkpoints", () => {
  assert.equal(checkpointConfigurations.length, 8);
  assert.equal(new Set(checkpointConfigurations.map((entry) => entry.sessionId)).size, 8);
});

for (const { sessionId, unitIds, count } of checkpointConfigurations) {
  test(`${sessionId} produces its configured deterministic checkpoint`, () => {
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
    assert.ok(perUnit.every((represented) => represented > 0));
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
    assert.ok(item.revision >= 2);
    assert.doesNotMatch(item.prompt.en, /according to|exercise \d/i);
    assert.doesNotMatch(item.prompt.lt, /pagal \d|pratimo tekst/i);
  });
});

test("repaired practice items carry the required evidence in both prompt languages", () => {
  const repairedItems = [
    {
      id: "u02.routine-reading.009",
      revision: 4,
      en: ["gets on a bus", "gets off near the school"],
      lt: ["įlipa į autobusą", "išlipa netoli mokyklos"],
    },
    {
      id: "u09.advice.013",
      revision: 2,
      en: ["important exam tomorrow", "has not studied"],
      lt: ["svarbus egzaminas", "dar nesimokė"],
    },
    {
      id: "u13.determiners.004",
      revision: 2,
      en: ["one specific charger", "a/an or the"],
      lt: ["vieną konkretų", "„a/an“ arba „the“"],
    },
    {
      id: "u13.determiners.008",
      revision: 2,
      en: ["one specific black backpack", "by the door"],
      lt: ["vieną konkretų juodą krepšį", "prie durų"],
    },
    {
      id: "u13.objects.011",
      revision: 2,
      en: ["small black backpack", "8:15 bus to Kaunas"],
      lt: ["mažą juodą krepšį", "kauno 8.15 val. autobuse"],
    },
    {
      id: "u13.objects.012",
      revision: 2,
      en: ["small black backpack", "small and ___"],
      lt: ["mažas juodas krepšys", "small and ___"],
    },
    {
      id: "u13.objects.013",
      revision: 2,
      en: ["green notebook", "two chargers", "pair of glasses"],
      lt: ["žalia užrašų knygelė", "du įkrovikliai", "akiniai"],
    },
    {
      id: "u13.objects.015",
      revision: 2,
      en: ["describe one other item", "before collecting"],
      lt: ["apibūdinti dar vieną", "prieš atsiimant"],
    },
    {
      id: "u13.objects.016",
      revision: 2,
      en: ["two wallets", "use one"],
      lt: ["dvi piniginės", "pavartokite „one“"],
    },
    {
      id: "u14.reflexive.013",
      revision: 2,
      en: ["ugnė hurt herself", "sam and i made dinner"],
      lt: ["ugnė susižeidė", "pagaminome vakarienę"],
    },
    {
      id: "u16.health.007",
      revision: 3,
      en: ["cough gets worse", "breathing is difficult"],
      lt: ["kosulys stiprėja", "sunku kvėpuoti"],
    },
    {
      id: "u18.patterns.007",
      revision: 3,
      en: ["bring a laptop", "install the free program"],
      lt: ["atsinešti nešiojamąjį kompiuterį", "įdiegti nemokamą programą"],
    },
    {
      id: "u18.course-skills.015",
      revision: 2,
      en: ["open the shared folder", "rename the file", "today's date"],
      lt: ["atidarykite bendrą aplanką", "pervadinti failą", "šiandienos datą"],
    },
    {
      id: "u18.course-skills.016",
      revision: 2,
      en: ["meaning pervadinti", "the file"],
      lt: ["anglišką veiksmažodį", "pervadinti"],
    },
    {
      id: "u20.social.006",
      revision: 2,
      en: ["my flat at 6:30", "starts at ___"],
      lt: ["mano bute 18.30", "įrašykite laiką"],
    },
    {
      id: "u20.social.007",
      revision: 3,
      en: ["by thursday", "prepare enough food"],
      lt: ["iki ketvirtadienio", "paruošti pakankamai maisto"],
    },
    {
      id: "u20.event-details.012",
      revision: 2,
      en: ["board-game evening on saturday", "is on ___"],
      lt: ["stalo žaidimų vakarą šeštadienį", "įrašykite dieną"],
    },
    {
      id: "u20.event-details.013",
      revision: 2,
      en: ["bring a small snack", "what can guests bring"],
      lt: ["atsineškite nedidelį užkandį", "ką svečiai gali atsinešti"],
    },
    {
      id: "u20.event-details.014",
      revision: 2,
      en: ["let me know by thursday", "reply deadline"],
      lt: ["praneškite man iki ketvirtadienio", "įrašykite terminą"],
    },
    {
      id: "u21.environment.003",
      revision: 3,
      en: ["first conditional with will", "reduce traffic pollution"],
      lt: ["pirmojo tipo sąlygos sakinį", "will"],
    },
    {
      id: "u21.environment.005",
      revision: 2,
      en: ["weather is dangerous", "following sunday"],
      lt: ["oras bus pavojingas", "kitą sekmadienį"],
    },
    {
      id: "u21.environment.007",
      revision: 2,
      en: ["provide gloves and rubbish bags", "what equipment"],
      lt: ["duosime pirštines ir šiukšlių maišus", "kokia įranga"],
    },
    {
      id: "u21.environment.008",
      revision: 2,
      en: ["first conditional with will", "turn off lights"],
      lt: ["pirmojo tipo sąlygos sakinį", "will"],
    },
    {
      id: "u21.community-action.012",
      revision: 2,
      en: ["footbridge on sunday at 10 a.m.", "meet at the ___"],
      lt: ["pėsčiųjų tilto sekmadienį 10 val.", "įrašykite vietą"],
    },
    {
      id: "u21.community-action.013",
      revision: 2,
      en: ["provide gloves and rubbish bags", "strong shoes", "enough water"],
      lt: ["duodame pirštines ir šiukšlių maišus", "tvirtus batus", "pakankamai vandens"],
    },
    {
      id: "u21.community-action.014",
      revision: 2,
      en: ["children under 14", "with an adult"],
      lt: ["vaikai iki 14 metų", "su suaugusiuoju"],
    },
    {
      id: "u22.services.004",
      revision: 2,
      en: ["polite word please", "replace it"],
      lt: ["mandagų žodį", "please"],
    },
    {
      id: "u22.services.005",
      revision: 2,
      en: ["left side", "stopped working"],
      lt: ["kairioji", "nustojo veikti"],
    },
    {
      id: "u22.services.007",
      revision: 3,
      en: ["black headphones", "receive a refund"],
      lt: ["juodas ausines", "atgauti pinigus"],
    },
    {
      id: "u23.relative.005",
      revision: 3,
      en: ["dalia is a guide", "local history"],
      lt: ["dalia yra gidė", "vietos istoriją"],
    },
    {
      id: "u23.relative.007",
      revision: 2,
      en: ["green table serves simple local food", "children can play safely"],
      lt: ["green table tiekia paprastą vietinį maistą", "vaikai gali saugiai žaisti"],
    },
    {
      id: "u23.recommendations.002",
      revision: 2,
      en: ["green table serves local food indoors", "river park is a safe outdoor place"],
      lt: ["green table vietinis maistas tiekiamas patalpoje", "river park yra saugi vieta lauke"],
    },
    {
      id: "u24.project.001",
      revision: 2,
      en: ["maya is vegetarian", "food constraint"],
      lt: ["maya yra vegetarė", "maisto apribojimas"],
    },
    {
      id: "u24.project.002",
      revision: 3,
      en: ["arrival: friday at 18:20", "when does maya arrive"],
      lt: ["atvykimas: penktadienį 18.20", "kada maya atvyksta"],
    },
    {
      id: "u24.project.003",
      revision: 3,
      en: ["weekend budget: €90", "budget is €___"],
      lt: ["savaitgalio biudžetas – 90 eurų", "įrašykite sumą"],
    },
    {
      id: "u24.constraints.001",
      revision: 2,
      en: [
        "friday at 18:20",
        "vegetarian",
        "nature and local history",
        "€90 budget",
        "cannot walk long distances",
        "heavy rain",
      ],
      lt: [
        "penktadienį 18.20",
        "vegetarė",
        "gamta ir vietos istorija",
        "90 € biudžetą",
        "negali nueiti didelių atstumų",
        "smarkiai lyti",
      ],
    },
  ];
  const itemMap = new Map(
    practiceCatalog.units.flatMap((unit) => unit.items).map((item) => [item.id, item]),
  );

  for (const expectation of repairedItems) {
    const item = itemMap.get(expectation.id);
    assert.ok(item, `missing repaired item ${expectation.id}`);
    assert.ok(
      item.revision >= expectation.revision,
      `${expectation.id} must retain revision ${expectation.revision} or later`,
    );

    for (const language of ["en", "lt"]) {
      const prompt = item.prompt[language].toLowerCase();
      for (const fragment of expectation[language]) {
        assert.ok(
          prompt.includes(fragment.toLowerCase()),
          `${expectation.id} ${language} prompt must include ${JSON.stringify(fragment)}`,
        );
      }
    }
  }
});

test("repaired fill-blank items accept each natural valid alternative", () => {
  const alternatives = new Map([
    ["u02.routine-reading.009", ["by bus", "on the bus"]],
    [
      "u05.place-prepositions.010",
      ["A pharmacy is opposite the park.", "The pharmacy is opposite the park."],
    ],
    [
      "u05.there-be.016",
      [
        "There are many restaurants on this street.",
        "There are a lot of restaurants on this street.",
        "There are lots of restaurants on this street.",
      ],
    ],
    ["u22.service-solutions.004", ["solve", "with"]],
  ]);
  const itemMap = new Map(
    practiceCatalog.units.flatMap((unit) => unit.items).map((item) => [item.id, item]),
  );

  for (const [id, responses] of alternatives) {
    const item = itemMap.get(id);
    assert.ok(item && item.type === "fill-blank", `missing fill-blank item ${id}`);
    for (const response of responses) {
      assert.equal(
        scorePracticeItem(item, response).correct,
        true,
        `${id} should accept ${JSON.stringify(response)}`,
      );
    }
  }
});

test("each unit uses distinct scored prompts", () => {
  for (const unit of practiceCatalog.units) {
    const promptOwners = new Map();
    for (const item of unit.items) {
      const signature = item.prompt.en.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
      assert.equal(
        promptOwners.has(signature),
        false,
        `${unit.unitId} duplicates the prompt from ${promptOwners.get(signature)} in ${item.id}`,
      );
      promptOwners.set(signature, item.id);
    }
  }
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
  assert.equal(result.catalog.units.length, 24);
  assert.ok(result.itemCount >= 387);
});
