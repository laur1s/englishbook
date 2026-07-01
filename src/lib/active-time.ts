export type VisibleTimeTracker = {
  setVisible: (visible: boolean) => void;
  elapsedMilliseconds: () => number;
  completedMinutes: (plannedMinutes: number) => number;
};

/**
 * Accumulates only time while the page is visible. Completion minutes are
 * intentionally rounded up to one minute and never exceed the planned time.
 */
export const createVisibleTimeTracker = (
  now: () => number = Date.now,
  initiallyVisible = true,
): VisibleTimeTracker => {
  let accumulatedMilliseconds = 0;
  let visibleSince = initiallyVisible ? now() : null;

  const elapsedMilliseconds = () => {
    const currentSegment = visibleSince === null
      ? 0
      : Math.max(0, now() - visibleSince);
    return accumulatedMilliseconds + currentSegment;
  };

  const setVisible = (visible: boolean) => {
    const timestamp = now();

    if (visible) {
      if (visibleSince === null) visibleSince = timestamp;
      return;
    }

    if (visibleSince !== null) {
      accumulatedMilliseconds += Math.max(0, timestamp - visibleSince);
      visibleSince = null;
    }
  };

  const completedMinutes = (plannedMinutes: number) => {
    const safePlannedMinutes = Number.isFinite(plannedMinutes)
      ? Math.max(1, Math.floor(plannedMinutes))
      : 1;
    const activeMinutes = Math.ceil(elapsedMilliseconds() / 60_000);
    return Math.max(1, Math.min(safePlannedMinutes, activeMinutes));
  };

  return { setVisible, elapsedMilliseconds, completedMinutes };
};
