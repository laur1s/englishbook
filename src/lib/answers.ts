import type { AnswerKeyEntry, GreyBookEntry, A2UnitEntry } from "./content";
import { getEntryBody } from "./content";

export const extractA2AnswerSnippet = (
  answerEntry: AnswerKeyEntry,
  unit: A2UnitEntry,
) => {
  const body = getEntryBody(answerEntry);
  const startPattern = new RegExp(`^## Unit ${unit.data.order}:`, "m");
  const startMatch = startPattern.exec(body);

  if (!startMatch?.index && startMatch?.index !== 0) {
    return "";
  }

  const start = startMatch.index;
  const remainder = body.slice(start + startMatch[0].length);
  const nextMatch = /^## Unit \d+:/m.exec(remainder);
  const end = nextMatch ? start + startMatch[0].length + nextMatch.index : body.length;
  return body.slice(start, end).trim();
};

export const extractGreyAnswerSnippet = (
  answerEntry: AnswerKeyEntry,
  chapter: GreyBookEntry,
) => {
  const body = getEntryBody(answerEntry);
  const startPattern = new RegExp(`^### Chapter ${chapter.data.order} Understanding`, "m");
  const startMatch = startPattern.exec(body);

  if (!startMatch?.index && startMatch?.index !== 0) {
    return "";
  }

  const start = startMatch.index;
  const remainder = body.slice(start + startMatch[0].length);
  const nextMatch = /^### Chapter \d+ Understanding/m.exec(remainder);
  const end = nextMatch ? start + startMatch[0].length + nextMatch.index : body.length;
  return body.slice(start, end).trim();
};
