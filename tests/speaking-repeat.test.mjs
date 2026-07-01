import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const read = (relativePath) =>
  readFileSync(new URL(`../${relativePath}`, import.meta.url), "utf8");

const missionPlayer = read("src/components/MissionPlayer.astro");
const sessionRunner = read("src/components/SessionRunner.astro");

test("guided speaking repeats pass the fresh-run contract into MissionPlayer", () => {
  assert.match(
    sessionRunner,
    /<MissionPlayer[\s\S]*?resetOnFreshRequest[\s\S]*?\/>/,
  );
  assert.match(
    missionPlayer,
    /data-reset-on-fresh-request=\{String\(resetOnFreshRequest\)\}/,
  );
  assert.match(
    missionPlayer,
    /searchParams\.get\("fresh"\) === "1"/,
  );
});

test("a fresh speaking run archives completion evidence but resets current-run state", () => {
  const resetStart = missionPlayer.indexOf("if (shouldStartFreshRun)");
  const restoreStart = missionPlayer.indexOf("const initialRecord = selectCurrentRecord");
  const resetSource = missionPlayer.slice(resetStart, restoreStart);

  assert.ok(resetStart >= 0 && restoreStart > resetStart, "fresh reset must run before restoration");
  assert.match(resetSource, /archiveCompletedRun\(storedRecord\.completedRuns, storedRecord\)/);
  assert.match(resetSource, /completedRuns: nextCompletedRuns/);
  assert.match(resetSource, /activeStep: 0/);
  assert.doesNotMatch(resetSource, /listening:\s*storedRecord\.listening/);
  assert.doesNotMatch(resetSource, /lastConfidence:\s*storedRecord\.lastConfidence/);
});

test("the fresh query is removed after MissionPlayer has consumed it", () => {
  assert.match(
    sessionRunner,
    /isFreshRequest && session\.kind === "content" && session\.stage === "speak"/,
  );
  assert.match(sessionRunner, /cleanUrl\.searchParams\.delete\("fresh"\)/);
  assert.match(sessionRunner, /window\.history\.replaceState/);
});

test("shadowing instructions support either audio or text input", () => {
  assert.match(missionPlayer, /Read or listen, then repeat/);
  assert.match(missionPlayer, /Perskaitykite arba klausykitės, tada pakartokite/);
  assert.doesNotMatch(missionPlayer, /Listen and repeat · Klausykitės ir pakartokite/);
});
