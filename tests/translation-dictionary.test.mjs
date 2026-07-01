import assert from "node:assert/strict";
import test from "node:test";

import {
  extractTranslationPairs,
  getTranslationDictionary,
} from "../src/lib/translation-dictionary.ts";

test("English explanatory parentheticals are not translations", () => {
  assert.deepEqual(
    extractTranslationPairs("There is (a lot of / many) water in the bottle."),
    [],
  );
  assert.deepEqual(extractTranslationPairs("Possession: have (own), own, belong."), []);
});

test("explicit Lithuanian parenthetical glosses are retained", () => {
  assert.deepEqual(extractTranslationPairs("- wake up — become awake (atsibusti)"), [
    { english: "wake up", lithuanian: "atsibusti" },
  ]);
  assert.deepEqual(extractTranslationPairs("was born (I was born - Aš gimiau)"), [
    { english: "born", lithuanian: "Aš gimiau" },
    { english: "was born", lithuanian: "Aš gimiau" },
  ]);
});

test("ambiguous multi-column study rows are not guessed", () => {
  assert.deepEqual(extractTranslationPairs("- Have - Had - Turėti"), []);
  assert.deepEqual(
    extractTranslationPairs("- be born - gimti (I was born - Aš gimiau)"),
    [],
  );
});

test("generated dictionary excludes known false mappings", () => {
  const dictionary = getTranslationDictionary();

  assert.equal(dictionary.is?.includes("a lot of / many") ?? false, false);
  assert.equal(dictionary.have?.includes("own") ?? false, false);
  assert.equal(dictionary.have?.includes("Had - Turėti") ?? false, false);
  assert.equal(dictionary.have?.includes("turėti") ?? false, true);
});
