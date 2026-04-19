import type { A2UnitEntry, SpeakingMissionEntry } from "./content";

export const SPEAKING_PROGRESS_KEY = "english-library.speaking.progress";

export const MISSION_TYPE_LABELS = {
  "one-minute-mission": "One-minute mission",
  "role-flip-dialogue": "Role-flip dialogue",
  "mistake-detective": "Mistake detective",
  "shadow-scene": "Shadow scene",
  "conversation-roulette": "Conversation roulette",
} as const;

export const STEP_KIND_LABELS = {
  brief: "Brief",
  prep: "Prep",
  speak: "Speak",
  compare: "Compare",
  reflect: "Reflect",
} as const;

export const formatDurationMinutes = (minutes: number) => `${minutes} min`;

export const getPrimarySourceSlug = (entry: SpeakingMissionEntry) =>
  entry.data.sourceRefs[0] ?? "";

export const getSourceUnit = (
  entry: SpeakingMissionEntry,
  units: A2UnitEntry[],
) => units.find((unit) => entry.data.sourceRefs.includes(unit.data.slug));

export const findSpeakingMissionForSource = (
  entries: SpeakingMissionEntry[],
  unitSlug: string,
) => entries.find((entry) => entry.data.sourceRefs.includes(unitSlug));
