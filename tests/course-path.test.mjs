import assert from "node:assert/strict";
import test from "node:test";

import {
  COURSE_SESSION_STAGES,
  coursePath,
  getModuleById,
  getNextSessionId,
  getSessionById,
  modules,
  sessions,
  validateCoursePath,
} from "../src/lib/course-path.ts";

const clonePath = () => structuredClone(coursePath);

test("the A2 course exposes 12 ordered modules and 60 stable sessions", () => {
  assert.equal(modules.length, 12);
  assert.equal(sessions.length, 60);
  assert.deepEqual(
    modules.map((module) => module.id),
    Array.from({ length: 12 }, (_, index) => `module-${String(index + 1).padStart(2, "0")}`),
  );

  for (const module of modules) {
    assert.deepEqual(
      module.sessions.map((session) => session.stage),
      COURSE_SESSION_STAGES,
    );
    assert.equal(module.sessions.length, 5);
  }
});

test("lookup helpers find modules, sessions, and the next linear session", () => {
  assert.equal(getModuleById("module-07")?.unitSlug, "unit-07");
  assert.equal(getSessionById("module-01-learn")?.stage, "learn");
  assert.equal(getNextSessionId("module-01-context"), "module-01-learn");
  assert.equal(getNextSessionId("module-01-review"), "module-02-context");
  assert.equal(getNextSessionId("module-12-review"), undefined);
  assert.equal(getModuleById("module-99"), undefined);
  assert.equal(getSessionById("missing-session"), undefined);
  assert.equal(getNextSessionId("missing-session"), undefined);
});

test("checkpoint sessions draw from the intended cumulative unit ranges", () => {
  assert.deepEqual(getSessionById("module-03-review")?.unitIds, ["unit-01", "unit-02", "unit-03"]);
  assert.deepEqual(getSessionById("module-06-review")?.unitIds, [
    "unit-01", "unit-02", "unit-03", "unit-04", "unit-05", "unit-06",
  ]);
  assert.deepEqual(getSessionById("module-09-review")?.unitIds, ["unit-07", "unit-08", "unit-09"]);
  assert.equal(getSessionById("module-12-review")?.unitIds.length, 12);
});

test("validation orders a valid manifest independently of source array order", () => {
  const reversed = clonePath();
  reversed.modules.reverse();
  reversed.modules.forEach((module) => module.sessions.reverse());

  const validated = validateCoursePath(reversed);

  assert.equal(validated.modules[0].id, "module-01");
  assert.deepEqual(
    validated.modules[0].sessions.map((session) => session.stage),
    COURSE_SESSION_STAGES,
  );
});

test("validation rejects duplicate module and session ids", async (t) => {
  await t.test("duplicate module id", () => {
    const invalid = clonePath();
    invalid.modules[1].id = invalid.modules[0].id;
    assert.throws(() => validateCoursePath(invalid), /Duplicate module id/);
  });

  await t.test("duplicate session id", () => {
    const invalid = clonePath();
    invalid.modules[1].sessions[0].id = invalid.modules[0].sessions[0].id;
    assert.throws(() => validateCoursePath(invalid), /Duplicate session id/);
  });
});

test("validation rejects missing modules and stage gaps", async (t) => {
  await t.test("module gap", () => {
    const invalid = clonePath();
    invalid.modules.splice(5, 1);
    assert.throws(() => validateCoursePath(invalid), /exactly 12 modules with no order gaps/);
  });

  await t.test("session stage gap", () => {
    const invalid = clonePath();
    invalid.modules[0].sessions.splice(2, 1);
    assert.throws(() => validateCoursePath(invalid), /exactly five sessions/);
  });
});

test("validation rejects bad unit, mission, story, and practice references", async (t) => {
  await t.test("unit reference", () => {
    const invalid = clonePath();
    invalid.modules[0].unitSlug = "unit-99";
    assert.throws(() => validateCoursePath(invalid), /unitSlug must reference unit-01/);
  });

  await t.test("mission reference", () => {
    const invalid = clonePath();
    invalid.modules[0].missionSlug = "missing-mission";
    assert.throws(() => validateCoursePath(invalid), /missionSlug is not the current mission reference/);
  });

  await t.test("story reference", () => {
    const invalid = clonePath();
    invalid.modules[0].storySlug = "chapter-99";
    assert.throws(() => validateCoursePath(invalid), /storySlug must reference chapter-01/);
  });

  await t.test("practice unit reference", () => {
    const invalid = clonePath();
    const practiceSession = invalid.modules[0].sessions.find(
      (session) => session.stage === "practice",
    );
    practiceSession.unitId = "unit-02";
    assert.throws(() => validateCoursePath(invalid), /unitId must reference unit-01/);
  });

  await t.test("checkpoint unit range", () => {
    const invalid = clonePath();
    const checkpoint = invalid.modules[2].sessions.find(
      (session) => session.stage === "review",
    );
    checkpoint.unitIds = ["unit-01", "unit-02"];
    assert.throws(() => validateCoursePath(invalid), /must include the current unit unit-03/);
  });
});
