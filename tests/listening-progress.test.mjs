import assert from "node:assert/strict";
import test from "node:test";

import {
  answerListeningCheck,
  canUnlockListeningReflect,
  chooseListeningTranscriptAlternative,
  getListeningState,
  markListeningShadowed,
  normalizeListeningState,
  revealListeningTranscript,
  setListeningShadowed,
  startListeningPlayback,
} from "../src/lib/listening-progress.ts";

const CHECKS = ["gist", "detail"];

test("missing and corrupt listening data normalize to a safe locked state", () => {
  const empty = {
    assisted: false,
    played: false,
    revealed: false,
    responses: {},
    correctIds: [],
    firstAttemptCorrectIds: [],
    attemptedIds: [],
    shadowed: false,
  };

  assert.deepEqual(normalizeListeningState(undefined), empty);
  assert.deepEqual(getListeningState({ listening: "broken" }), empty);
  assert.deepEqual(
    getListeningState({
      listening: {
        assisted: "yes",
        played: 1,
        revealed: false,
        responses: { gist: "main", bad: 4 },
        attemptedIds: ["gist", "gist", 4],
        correctIds: ["gist", "missing", "gist"],
        shadowed: true,
      },
    }),
    {
      ...empty,
      responses: { gist: "main" },
      attemptedIds: ["gist"],
      correctIds: ["gist"],
    },
  );
});

test("playback and the accessible transcript alternative are tracked separately", () => {
  const initial = { activeStep: 2 };
  const played = startListeningPlayback(initial);
  const assisted = chooseListeningTranscriptAlternative(played);

  assert.equal(getListeningState(played).played, true);
  assert.equal(getListeningState(played).assisted, false);
  assert.equal(getListeningState(assisted).played, true);
  assert.equal(getListeningState(assisted).assisted, true);
  assert.equal(assisted.activeStep, 2);
  assert.deepEqual(initial, { activeStep: 2 });
});

test("a wrong answer remains an attempt and a repair can become correct", () => {
  const initial = { completed: false };
  const wrong = answerListeningCheck(initial, "gist", "weather", "travel");

  assert.deepEqual(getListeningState(wrong).attemptedIds, ["gist"]);
  assert.deepEqual(getListeningState(wrong).correctIds, []);
  assert.deepEqual(getListeningState(wrong).firstAttemptCorrectIds, []);
  assert.deepEqual(getListeningState(wrong).responses, { gist: "weather" });

  const repaired = answerListeningCheck(wrong, "gist", "travel", "travel");
  assert.deepEqual(getListeningState(repaired).attemptedIds, ["gist"]);
  assert.deepEqual(getListeningState(repaired).correctIds, ["gist"]);
  assert.deepEqual(getListeningState(repaired).firstAttemptCorrectIds, []);
  assert.deepEqual(getListeningState(repaired).responses, { gist: "travel" });
  assert.deepEqual(initial, { completed: false });
});

test("first-attempt accuracy stays honest after later repairs", () => {
  let record = answerListeningCheck({}, "gist", "travel", "travel");
  record = answerListeningCheck(record, "detail", "nine", "ten");
  record = answerListeningCheck(record, "detail", "ten", "ten");

  assert.deepEqual(getListeningState(record).correctIds, ["gist", "detail"]);
  assert.deepEqual(getListeningState(record).firstAttemptCorrectIds, ["gist"]);
});

test("the transcript reveal stays locked until every required check was attempted", () => {
  const oneAttempt = answerListeningCheck({}, "gist", "travel", "travel");
  const tooSoon = revealListeningTranscript(oneAttempt, CHECKS);
  assert.equal(getListeningState(tooSoon).revealed, false);

  const bothAttempted = answerListeningCheck(tooSoon, "detail", "nine", "ten");
  const revealed = revealListeningTranscript(bothAttempted, CHECKS);
  assert.equal(getListeningState(revealed).revealed, true);
  assert.deepEqual(getListeningState(bothAttempted).revealed, false);
});

test("shadowing cannot be marked before the transcript is revealed", () => {
  const locked = setListeningShadowed({}, true);
  assert.equal(getListeningState(locked).shadowed, false);

  let ready = answerListeningCheck({}, "gist", "travel", "travel");
  ready = answerListeningCheck(ready, "detail", "ten", "ten");
  ready = revealListeningTranscript(ready, CHECKS);
  const shadowed = markListeningShadowed(ready);

  assert.equal(getListeningState(shadowed).shadowed, true);
  assert.equal(getListeningState(ready).shadowed, false);

  const unchecked = setListeningShadowed(shadowed, false);
  assert.equal(getListeningState(unchecked).shadowed, false);
  assert.equal(canUnlockListeningReflect(unchecked, CHECKS), false);
  assert.equal(getListeningState(shadowed).shadowed, true);
});

test("Reflect unlocks only after correct repair, reveal, and shadowing", () => {
  let record = answerListeningCheck({}, "gist", "travel", "travel");
  record = answerListeningCheck(record, "detail", "nine", "ten");
  record = revealListeningTranscript(record, CHECKS);
  record = markListeningShadowed(record);

  assert.equal(canUnlockListeningReflect(record, CHECKS), false);

  const repaired = answerListeningCheck(record, "detail", "ten", "ten");
  assert.equal(canUnlockListeningReflect(repaired, CHECKS), true);

  const changedToWrong = answerListeningCheck(repaired, "detail", "nine", "ten");
  assert.equal(canUnlockListeningReflect(changedToWrong, CHECKS), false);
});

test("normalized persisted state is independent of its source object", () => {
  const persisted = {
    listening: {
      assisted: true,
      played: true,
      revealed: true,
      responses: { gist: "travel", detail: "ten" },
        correctIds: ["gist", "detail"],
        firstAttemptCorrectIds: ["gist", "detail"],
      attemptedIds: ["gist", "detail"],
      shadowed: true,
    },
  };
  const state = getListeningState(persisted);

  state.responses.gist = "changed";
  state.correctIds.push("extra");

  assert.equal(persisted.listening.responses.gist, "travel");
  assert.deepEqual(persisted.listening.correctIds, ["gist", "detail"]);
  assert.deepEqual(persisted.listening.firstAttemptCorrectIds, ["gist", "detail"]);
  assert.equal(canUnlockListeningReflect(persisted, CHECKS), true);
});
