import type { BilingualText, PracticeItem } from "./schema";

export type PracticeScoreResult = {
  correct: boolean;
  normalizedResponse: string;
  expected: string[];
  rationale: BilingualText;
};

export const normalizePracticeResponse = (
  value: string,
  { caseSensitive = false }: { caseSensitive?: boolean } = {},
) => {
  const normalized = String(value)
    .trim()
    .replace(/[’‘]/g, "'")
    .replace(/\s+/g, " ");

  return caseSensitive ? normalized : normalized.toLocaleLowerCase("en");
};

export const scorePracticeItem = (
  item: PracticeItem,
  response: string,
): PracticeScoreResult => {
  if (item.type === "single-choice") {
    const normalizedResponse = String(response).trim();
    const correctChoice = item.choices.find(
      (choice) => choice.id === item.answer.choiceId,
    );

    if (!correctChoice) {
      throw new Error(`Practice item ${item.id} has no matching correct choice`);
    }

    return {
      correct: normalizedResponse === item.answer.choiceId,
      normalizedResponse,
      expected: [correctChoice.text],
      rationale: { ...item.rationale },
    };
  }

  const normalizedResponse = normalizePracticeResponse(response, {
    caseSensitive: item.answer.caseSensitive,
  });
  const normalizedAccepted = item.answer.accepted.map((answer) =>
    normalizePracticeResponse(answer, {
      caseSensitive: item.answer.caseSensitive,
    }),
  );

  return {
    correct: normalizedAccepted.includes(normalizedResponse),
    normalizedResponse,
    expected: [...item.answer.accepted],
    rationale: { ...item.rationale },
  };
};
