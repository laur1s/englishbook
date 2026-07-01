import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { runInNewContext } from "node:vm";

import {
  LEARNING_PROGRESS_KEY,
  completeLearningSession,
  createLearningProgress,
  readLearningProgress,
  startLearningSession,
  writeLearningProgress,
} from "../src/lib/learning-progress.ts";
import { commitPersistedValue } from "../src/lib/persistence.ts";

const makeStorage = (initial = {}, { denyRead = false, quotaExceeded = false } = {}) => {
  const values = new Map(Object.entries(initial));
  return {
    values,
    getItem(key) {
      if (denyRead) throw new Error("storage denied");
      return values.get(key) ?? null;
    },
    setItem(key, value) {
      if (quotaExceeded) {
        const error = new Error("quota exhausted");
        error.name = "QuotaExceededError";
        throw error;
      }
      values.set(key, value);
    },
    removeItem(key) {
      values.delete(key);
    },
  };
};

const completeGuidedStep = (storage, current) => {
  const next = completeLearningSession(current, "module-01-context", {
    revision: 1,
    minutes: 1,
    activityType: "content",
  });
  return commitPersistedValue(
    current,
    next,
    (candidate) => writeLearningProgress(storage, candidate),
  );
};

test("guided completion retains its durable started state when quota is exhausted", () => {
  const started = startLearningSession(createLearningProgress(), "module-01-context", 1);
  const seeded = makeStorage();
  assert.equal(writeLearningProgress(seeded, started), true);
  const quotaStorage = makeStorage(
    { [LEARNING_PROGRESS_KEY]: seeded.values.get(LEARNING_PROGRESS_KEY) },
    { quotaExceeded: true },
  );
  const current = readLearningProgress(quotaStorage, []);
  const result = completeGuidedStep(quotaStorage, current);

  assert.equal(result.saved, false);
  assert.equal(result.value.sessions["module-01-context"].status, "started");
  assert.equal(
    JSON.parse(quotaStorage.values.get(LEARNING_PROGRESS_KEY)).sessions["module-01-context"].status,
    "started",
  );
});

test("guided completion remains unfinished when storage access is denied", () => {
  const denied = makeStorage({}, { denyRead: true, quotaExceeded: true });
  const clean = readLearningProgress(denied, []);
  const started = startLearningSession(clean, "module-01-context", 1);
  const result = completeGuidedStep(denied, started);

  assert.equal(result.saved, false);
  assert.equal(result.value.sessions["module-01-context"].status, "started");
});

test("guided progress recovers from corrupt JSON once storage becomes writable", () => {
  const storage = makeStorage({ [LEARNING_PROGRESS_KEY]: "{not-json" });
  const clean = readLearningProgress(storage, []);
  const started = startLearningSession(clean, "module-01-context", 1);
  const result = completeGuidedStep(storage, started);

  assert.equal(result.saved, true);
  assert.equal(readLearningProgress(storage, []).sessions["module-01-context"].status, "completed");
});

const missionPlayer = readFileSync(
  new URL("../src/components/MissionPlayer.astro", import.meta.url),
  "utf8",
);
const speakingStorageSource = missionPlayer.slice(
  missionPlayer.indexOf("const readSpeakingProgress"),
  missionPlayer.indexOf("const isSpeakingRecord"),
);

const loadSpeakingStorage = (localStorage) => {
  let dispatched = 0;
  const sandbox = {
    localStorage,
    progressKey: "english-library.speaking.progress",
    CustomEvent: class CustomEvent {
      constructor(type) {
        this.type = type;
      }
    },
    window: {
      dispatchEvent: () => {
        dispatched += 1;
      },
    },
  };
  runInNewContext(`${speakingStorageSource}
    globalThis.readSpeakingProgress = readSpeakingProgress;
    globalThis.writeSpeakingProgress = writeSpeakingProgress;
  `, sandbox);
  return {
    read: sandbox.readSpeakingProgress,
    write: sandbox.writeSpeakingProgress,
    dispatched: () => dispatched,
  };
};

test("speaking storage treats corrupt and denied reads as empty progress", () => {
  const corrupt = loadSpeakingStorage(makeStorage({
    "english-library.speaking.progress": "{not-json",
  }));
  const denied = loadSpeakingStorage(makeStorage({}, { denyRead: true }));

  assert.deepEqual(JSON.parse(JSON.stringify(corrupt.read())), {});
  assert.deepEqual(JSON.parse(JSON.stringify(denied.read())), {});
});

test("speaking completion write reports quota failure and leaves durable state unchanged", () => {
  const key = "english-library.speaking.progress";
  const durable = {
    "mission-one": { revision: 1, completed: false, startedAt: "2026-07-01T10:00:00.000Z" },
  };
  const storage = makeStorage({ [key]: JSON.stringify(durable) }, { quotaExceeded: true });
  const speaking = loadSpeakingStorage(storage);
  const completed = {
    "mission-one": {
      ...durable["mission-one"],
      completed: true,
      completedAt: "2026-07-01T10:05:00.000Z",
    },
  };
  const committed = commitPersistedValue(
    durable,
    completed,
    (candidate) => speaking.write(candidate),
  );

  assert.equal(committed.saved, false);
  assert.equal(committed.value["mission-one"].completed, false);
  assert.deepEqual(JSON.parse(storage.values.get(key)), durable);
  assert.equal(speaking.dispatched(), 0);
});
