import assert from "node:assert/strict";
import test from "node:test";

import {
  findTranslationMatches,
  lookupTranslation,
} from "../src/lib/translation-lookup.ts";

test("unsupported text is left without lookup matches", () => {
  assert.deepEqual(
    findTranslationMatches("Ordinary text only.", { hospital: ["ligoninė"] }),
    [],
  );
});

test("lookup matching ignores surrounding punctuation and case", () => {
  const text = "HOSPITAL, hospital.";
  const matches = findTranslationMatches(text, { hospital: ["ligoninė"] });

  assert.deepEqual(matches.map(({ start, end, key }) => ({
    text: text.slice(start, end),
    key,
  })), [
    { text: "HOSPITAL", key: "hospital" },
    { text: "hospital", key: "hospital" },
  ]);
});

test("plural words can resolve to a singular dictionary entry", () => {
  assert.deepEqual(
    lookupTranslation(["Reports"], { report: ["ataskaita"] }),
    {
      key: "report",
      matchedTerm: "Reports",
      translations: ["ataskaita"],
    },
  );
});

test("the longest phrase wins without overlapping word matches", () => {
  const text = "Put on and put.";
  const matches = findTranslationMatches(text, {
    put: ["dėti"],
    "put on": ["apsivilkti"],
    on: ["ant"],
  });

  assert.deepEqual(matches.map(({ start, end, key }) => ({
    text: text.slice(start, end),
    key,
  })), [
    { text: "Put on", key: "put on" },
    { text: "put", key: "put" },
  ]);
});

test("phrase matching does not cross punctuation", () => {
  assert.deepEqual(
    findTranslationMatches("Look, after lunch.", {
      "look after": ["prižiūrėti"],
    }),
    [],
  );
});
