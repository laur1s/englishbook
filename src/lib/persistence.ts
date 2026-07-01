export type PersistedCommit<T> = {
  saved: boolean;
  value: T;
};

export type WritableStorage = Pick<Storage, "getItem" | "setItem" | "removeItem">;

/**
 * Verify that storage is writable before a learner starts guided work. Reading
 * alone is not enough because private or quota-limited contexts can expose the
 * API while rejecting every write.
 */
export const canUsePersistentStorage = (storage: WritableStorage): boolean => {
  const key = `english-library.storage-probe.${Date.now()}.${Math.random()}`;

  try {
    storage.setItem(key, "available");
    const available = storage.getItem(key) === "available";
    storage.removeItem(key);
    return available;
  } catch {
    try {
      storage.removeItem(key);
    } catch {
      // A denied storage implementation can reject cleanup too.
    }
    return false;
  }
};

/**
 * Keep the last durable value when a storage write fails. This lets callers
 * avoid rendering a completed state that will disappear on refresh.
 */
export const commitPersistedValue = <T>(
  currentValue: T,
  nextValue: T,
  write: (value: T) => boolean,
): PersistedCommit<T> => {
  try {
    if (write(nextValue)) {
      return { saved: true, value: nextValue };
    }
  } catch {
    // Storage adapters may throw instead of returning false.
  }

  return { saved: false, value: currentValue };
};
