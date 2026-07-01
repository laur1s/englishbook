export type ListeningState = {
  assisted: boolean;
  played: boolean;
  revealed: boolean;
  responses: Record<string, string>;
  correctIds: string[];
  firstAttemptCorrectIds: string[];
  attemptedIds: string[];
  shadowed: boolean;
};

export type MissionRecordWithListening = Record<string, unknown> & {
  listening: ListeningState;
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  Boolean(value) && typeof value === "object" && !Array.isArray(value);

const uniqueIds = (value: unknown): string[] => {
  if (!Array.isArray(value)) return [];

  return [...new Set(
    value.filter((item): item is string => typeof item === "string" && item.trim().length > 0),
  )];
};

const requiredIds = (value: readonly string[]): string[] =>
  [...new Set(value.filter((item) => typeof item === "string" && item.trim().length > 0))];

export const normalizeListeningState = (value: unknown): ListeningState => {
  const source = isRecord(value) ? value : {};
  const responses = isRecord(source.responses)
    ? Object.entries(source.responses).reduce<Record<string, string>>(
        (validResponses, [checkId, responseId]) => {
          if (checkId.trim().length > 0 && typeof responseId === "string") {
            validResponses[checkId] = responseId;
          }
          return validResponses;
        },
        {},
      )
    : {};
  const attemptedIds = uniqueIds(source.attemptedIds);
  const attemptedSet = new Set(attemptedIds);
  const correctIds = uniqueIds(source.correctIds).filter(
    (checkId) => attemptedSet.has(checkId) && typeof responses[checkId] === "string",
  );
  const firstAttemptCorrectIds = uniqueIds(source.firstAttemptCorrectIds).filter(
    (checkId) => attemptedSet.has(checkId),
  );
  const revealed = source.revealed === true;

  return {
    assisted: source.assisted === true,
    played: source.played === true,
    revealed,
    responses,
    correctIds,
    firstAttemptCorrectIds,
    attemptedIds,
    shadowed: revealed && source.shadowed === true,
  };
};

export const getListeningState = (record: unknown): ListeningState =>
  normalizeListeningState(isRecord(record) ? record.listening : undefined);

const withListeningState = (
  record: unknown,
  update: (state: ListeningState) => ListeningState,
): MissionRecordWithListening => {
  const source = isRecord(record) ? record : {};

  return {
    ...source,
    listening: update(getListeningState(source)),
  };
};

export const startListeningPlayback = (record: unknown): MissionRecordWithListening =>
  withListeningState(record, (state) => ({ ...state, played: true }));

export const chooseListeningTranscriptAlternative = (
  record: unknown,
): MissionRecordWithListening =>
  withListeningState(record, (state) => ({ ...state, assisted: true }));

export const answerListeningCheck = (
  record: unknown,
  checkId: string,
  responseId: string,
  correctAnswerId: string,
): MissionRecordWithListening =>
  withListeningState(record, (state) => {
    if (!checkId.trim() || !responseId.trim() || !correctAnswerId.trim()) return state;

    const attemptedIds = state.attemptedIds.includes(checkId)
      ? state.attemptedIds
      : [...state.attemptedIds, checkId];
    const isFirstAttempt = !state.attemptedIds.includes(checkId);
    const isCorrect = responseId === correctAnswerId;
    const correctIds = isCorrect
      ? state.correctIds.includes(checkId)
        ? state.correctIds
        : [...state.correctIds, checkId]
      : state.correctIds.filter((id) => id !== checkId);
    const firstAttemptCorrectIds = isFirstAttempt && isCorrect
      ? [...state.firstAttemptCorrectIds, checkId]
      : state.firstAttemptCorrectIds;

    return {
      ...state,
      responses: { ...state.responses, [checkId]: responseId },
      attemptedIds,
      correctIds,
      firstAttemptCorrectIds,
    };
  });

export const hasAttemptedAllListeningChecks = (
  record: unknown,
  requiredCheckIds: readonly string[],
): boolean => {
  const state = getListeningState(record);
  return requiredIds(requiredCheckIds).every((checkId) => state.attemptedIds.includes(checkId));
};

export const revealListeningTranscript = (
  record: unknown,
  requiredCheckIds: readonly string[],
): MissionRecordWithListening =>
  withListeningState(record, (state) => {
    const canReveal = requiredIds(requiredCheckIds).every((checkId) =>
      state.attemptedIds.includes(checkId),
    );

    return canReveal ? { ...state, revealed: true } : state;
  });

export const setListeningShadowed = (
  record: unknown,
  checked: boolean,
): MissionRecordWithListening =>
  withListeningState(record, (state) =>
    checked && !state.revealed
      ? state
      : { ...state, shadowed: checked },
  );

export const markListeningShadowed = (record: unknown): MissionRecordWithListening =>
  setListeningShadowed(record, true);

export const canUnlockListeningReflect = (
  record: unknown,
  requiredCheckIds: readonly string[],
): boolean => {
  const state = getListeningState(record);
  const checks = requiredIds(requiredCheckIds);

  return (
    state.revealed &&
    state.shadowed &&
    checks.every((checkId) => state.correctIds.includes(checkId))
  );
};
