import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { runInNewContext } from "node:vm";

import { SPEAKING_COMPLETED_RUN_LIMIT } from "../src/lib/speaking.ts";

const read = (relativePath) =>
  readFileSync(new URL(`../${relativePath}`, import.meta.url), "utf8");

const missionPlayer = read("src/components/MissionPlayer.astro");
const missionCard = read("src/components/SpeakingMissionCard.astro");
const speakingOverview = read("src/pages/speaking/index.astro");
const sessionRunner = read("src/components/SessionRunner.astro");
const learningDashboard = read("src/components/LearningDashboard.astro");

const historyHelpers = missionPlayer.slice(
  missionPlayer.indexOf("const isSpeakingRecord"),
  missionPlayer.indexOf("const formatCountdown"),
);

const loadHistoryHelpers = () => {
  const sandbox = { completedRunLimit: SPEAKING_COMPLETED_RUN_LIMIT };
  runInNewContext(`${historyHelpers}
    globalThis.sanitizeCompletedRuns = sanitizeCompletedRuns;
  `, sandbox);
  return sandbox;
};

test("speaking run history is sanitized and capped at five recent completions", () => {
  assert.equal(SPEAKING_COMPLETED_RUN_LIMIT, 5);
  assert.match(missionPlayer, /const sanitizeCompletedRun =/);
  assert.match(missionPlayer, /value\.completed !== true/);
  assert.match(missionPlayer, /const sanitizeRecordHistory =/);
  assert.match(missionPlayer, /sanitizeRecordHistory\(selectCurrentRecord\(progress\[slug\]\)\)/);
  assert.match(missionPlayer, /\.sort\(\(left, right\) => Date\.parse\(left\.completedAt\)/);
  assert.match(missionPlayer, /\.slice\(-completedRunLimit\)/);
  assert.match(missionPlayer, /archiveCompletedRun\(storedValue\.completedRuns, storedValue\)/);
});

test("speaking run sanitizer rejects malformed evidence, deduplicates, orders, and caps history", () => {
  const { sanitizeCompletedRuns } = loadHistoryHelpers();
  const histories = [
    null,
    { completed: false, completedAt: "2026-07-09T10:00:00.000Z" },
    { completed: true, completedAt: "not-a-date" },
    ...[7, 1, 6, 2, 5, 3, 4].map((day) => ({
      revision: 2,
      completed: true,
      completedAt: `2026-07-0${day}T10:00:00.000Z`,
      lastConfidence: day === 7 ? 5 : 3,
      selfChecks: day === 7 ? [" clear ", "", 7] : [],
      ignoredPayload: "drop this",
    })),
    {
      revision: 2,
      completed: true,
      completedAt: "2026-07-07T10:00:00.000Z",
      lastConfidence: 4,
      selfChecks: [" corrected ", "corrected"],
    },
  ];

  const sanitized = JSON.parse(JSON.stringify(sanitizeCompletedRuns(histories)));

  assert.equal(sanitized.length, 5);
  assert.deepEqual(
    sanitized.map((run) => run.completedAt),
    [3, 4, 5, 6, 7].map((day) => `2026-07-0${day}T10:00:00.000Z`),
  );
  assert.equal(sanitized.at(-1).lastConfidence, 4);
  assert.deepEqual(sanitized.at(-1).selfChecks, ["corrected"]);
  assert.equal("ignoredPayload" in sanitized.at(-1), false);
});

test("speaking overview progress is revision-aware and resyncs after lifecycle changes", () => {
  assert.match(missionCard, /missionRevision: number/);
  assert.match(missionCard, /data-mission-revision=\{String\(missionRevision\)\}/);
  assert.match(speakingOverview, /missionRevision=\{getContentSessionByHref/);
  assert.match(speakingOverview, /storedRevision === revision \? storedRecord : undefined/);
  assert.match(speakingOverview, /addEventListener\("storage"/);
  assert.match(speakingOverview, /addEventListener\("pageshow", syncProgress\)/);
  assert.match(speakingOverview, /addEventListener\("focus", syncProgress\)/);
  assert.match(speakingOverview, /addEventListener\("english-library:speaking-progress", syncProgress\)/);
  assert.match(speakingOverview, /addEventListener\("visibilitychange"/);
});

test("recording controls restore focus as their visible action changes", () => {
  assert.match(missionPlayer, /requestAnimationFrame\(\(\) => stopButton\?\.focus\(\)\)/);
  assert.match(missionPlayer, /const focusTarget = audioUrl && playback && !playback\.hidden/);
  assert.match(missionPlayer, /recordButton && !recordButton\.hidden/);
  assert.match(missionPlayer, /requestAnimationFrame\(\(\) => focusTarget\?\.focus\(\)\)/);
});

test("embedded speaking completion can reject an unsaved course transition", () => {
  assert.match(missionPlayer, /cancelable: true/);
  assert.match(missionPlayer, /if \(!completionAccepted\)/);
  assert.match(missionPlayer, /Retry saving course step/);
  assert.match(sessionRunner, /if \(!commitCompletion\(nextProgress\)\)/);
  assert.match(sessionRunner, /event\.preventDefault\(\)/);
});

test("due listening evidence repeats its source mission instead of opening an empty practice pack", () => {
  assert.match(learningDashboard, /getListeningRecallSourceSessionId/);
  assert.match(learningDashboard, /reviewMode === "listening"/);
  assert.match(learningDashboard, /withPracticeMode\(reviewTarget\.href, "repeat"\)/);
  assert.match(learningDashboard, /2 listening checks/);
  assert.match(sessionRunner, /listening\.assisted !== true/);
  assert.match(
    sessionRunner,
    /session\.skillRefs\.filter\(\(skillId\) => skillId\.startsWith\("listening\."\)\)/,
  );
});

test("shadowing status never contradicts already-correct listening answers", () => {
  assert.match(
    missionPlayer,
    /Repeat practice saved\. Finish any corrections, then continue to Reflect\./,
  );
  assert.doesNotMatch(
    missionPlayer,
    /Repeat practice saved\. Correct both answers to continue\./,
  );
});
