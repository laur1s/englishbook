import assert from "node:assert/strict";
import test from "node:test";

import { parseRunnerData } from "../src/lib/runner-data.ts";

const validRunnerData = {
  revision: 2,
  module: { id: "module-01", order: 1, title: "Start here" },
  moduleSessions: [
    { id: "module-01-context", stage: "context", revision: 1, required: true },
  ],
  pathSessions: [
    { id: "module-01-context", revision: 1, required: true },
  ],
  session: {
    id: "module-01-context",
    kind: "content",
    stage: "context",
    title: "Read first",
    minutes: 5,
    skillRefs: ["reading.context"],
  },
  nextSessionId: null,
  nextHref: "/learn",
  dashboardHref: "/learn",
  studyEvidence: null,
};

test("runner data parser distinguishes missing, malformed, and invalid controller data", () => {
  assert.deepEqual(parseRunnerData(null), {
    ok: false,
    reason: "missing",
    message: "Session setup data is missing.",
  });
  assert.equal(parseRunnerData("{").reason, "malformed");
  assert.equal(parseRunnerData(JSON.stringify({ ...validRunnerData, pathSessions: [] })).reason, "invalid");
});

test("runner data parser accepts valid content and practice session payloads", () => {
  const content = parseRunnerData(JSON.stringify(validRunnerData));
  assert.equal(content.ok, true);

  const practice = parseRunnerData(JSON.stringify({
    ...validRunnerData,
    session: {
      ...validRunnerData.session,
      id: "module-01-practice",
      kind: "practice",
      stage: "practice",
      unitId: "unit-01",
      mode: "guided",
      count: 8,
    },
  }));
  assert.equal(practice.ok, true);
});
