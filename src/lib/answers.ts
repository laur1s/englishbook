import type { AnswerKeyEntry, GreyBookEntry, A2UnitEntry } from "./content";

const getBody = (entry: { body?: string }) => entry.body ?? "";

const extractHeadingSection = ({
  body,
  startPattern,
  nextPattern,
}: {
  body: string;
  startPattern: RegExp;
  nextPattern: RegExp;
}) => {
  const startMatch = startPattern.exec(body);

  if (startMatch?.index === undefined) {
    return "";
  }

  const contentStart = startMatch.index + startMatch[0].length;
  const remainder = body.slice(contentStart);
  const nextMatch = nextPattern.exec(remainder);
  const contentEnd = nextMatch ? contentStart + nextMatch.index : body.length;

  return body.slice(contentStart, contentEnd).trim();
};

export const extractA2AnswerSnippet = (
  answerEntry: AnswerKeyEntry,
  unit: A2UnitEntry,
) => {
  const body = getBody(answerEntry);

  return extractHeadingSection({
    body,
    startPattern: new RegExp(`^##\\s+Unit\\s+${unit.data.order}\\b[^\\n]*`, "im"),
    nextPattern: /^##\s+Unit\s+\d+\b[^\n]*/im,
  });
};

export const extractGreyAnswerSnippet = (
  answerEntry: AnswerKeyEntry,
  chapter: GreyBookEntry,
) => {
  const body = getBody(answerEntry);
  const order = chapter.data.order;
  const snippet = extractHeadingSection({
    body,
    startPattern: new RegExp(`^###\\s+Chapter\\s+${order}\\s+Understanding\\b[^\\n]*`, "im"),
    nextPattern: /^###\s+Chapter\s+\d+\s+Understanding\b[^\n]*/im,
  });

  if (!snippet) {
    return "";
  }

  return `### Understanding\n\n${snippet}`.replace(
    new RegExp(`^###\\s+Chapter\\s+${order}\\s+`, "gim"),
    "### ",
  );
};
