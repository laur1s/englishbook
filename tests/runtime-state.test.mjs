import assert from "node:assert/strict";
import test from "node:test";

import { createVisibleTimeTracker } from "../src/lib/active-time.ts";
import {
  canUsePersistentStorage,
  commitPersistedValue,
} from "../src/lib/persistence.ts";

test("persistent storage probing detects writable, denied, and silent-failure adapters", () => {
  const values = new Map();
  const writable = {
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, value),
    removeItem: (key) => values.delete(key),
  };
  const denied = {
    getItem: () => null,
    setItem: () => {
      throw new Error("quota denied");
    },
    removeItem: () => {},
  };
  const silentFailure = {
    getItem: () => null,
    setItem: () => {},
    removeItem: () => {},
  };

  assert.equal(canUsePersistentStorage(writable), true);
  assert.equal(values.size, 0, "the probe key must be removed after success");
  assert.equal(canUsePersistentStorage(denied), false);
  assert.equal(canUsePersistentStorage(silentFailure), false);
});

test("a failed persistence commit retains the last durable value", () => {
  const current = { status: "started" };
  const next = { status: "completed" };

  assert.deepEqual(commitPersistedValue(current, next, () => false), {
    saved: false,
    value: current,
  });
  assert.deepEqual(commitPersistedValue(current, next, () => true), {
    saved: true,
    value: next,
  });
  assert.deepEqual(commitPersistedValue(current, next, () => {
    throw new Error("storage denied");
  }), {
    saved: false,
    value: current,
  });
});

test("completion time counts visible intervals only and caps at the plan", () => {
  let clock = 0;
  const tracker = createVisibleTimeTracker(() => clock, true);

  clock = 75_000;
  tracker.setVisible(false);
  clock = 675_000;
  assert.equal(tracker.completedMinutes(10), 2);

  tracker.setVisible(true);
  clock = 1_275_000;
  assert.equal(tracker.completedMinutes(5), 5);
  assert.equal(tracker.elapsedMilliseconds(), 675_000);
});

test("a newly completed session still records the minimum one minute", () => {
  let clock = 10_000;
  const tracker = createVisibleTimeTracker(() => clock, false);

  assert.equal(tracker.completedMinutes(8), 1);
  tracker.setVisible(true);
  clock += 1_000;
  assert.equal(tracker.completedMinutes(8), 1);
});

test("visibility transitions are idempotent and a backwards clock cannot remove active time", () => {
  let clock = 20_000;
  const tracker = createVisibleTimeTracker(() => clock, true);

  clock = 50_000;
  tracker.setVisible(true);
  clock = 10_000;
  tracker.setVisible(false);
  tracker.setVisible(false);

  assert.equal(tracker.elapsedMilliseconds(), 0);

  clock = 70_000;
  tracker.setVisible(true);
  clock = 130_000;
  assert.equal(tracker.elapsedMilliseconds(), 60_000);
});
