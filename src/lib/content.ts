import { getCollection, type CollectionEntry } from "astro:content";

import { withBase } from "./constants";

export type GreyBookEntry = CollectionEntry<"greyBook">;
export type A2UnitEntry = CollectionEntry<"a2Units">;
export type ResourceEntry = CollectionEntry<"resources">;
export type AnswerKeyEntry = CollectionEntry<"answerKeys">;
export type SpeakingMissionEntry = CollectionEntry<"speakingMissions">;
export type LibraryEntry =
  | GreyBookEntry
  | A2UnitEntry
  | ResourceEntry
  | SpeakingMissionEntry;

type OrderedEntry = {
  data: {
    order: number;
    slug: string;
    collection: string;
  };
};

export const sortEntries = <T extends OrderedEntry>(entries: T[]) =>
  [...entries].sort((left, right) => left.data.order - right.data.order);

export const getGreyBookEntries = async () =>
  sortEntries(await getCollection("greyBook"));

export const getA2Entries = async () => sortEntries(await getCollection("a2Units"));

export const getResourceEntries = async () =>
  sortEntries(await getCollection("resources"));

export const getAnswerKeyEntries = async () =>
  sortEntries(await getCollection("answerKeys"));

export const getSpeakingMissionEntries = async () =>
  sortEntries(await getCollection("speakingMissions"));

export const getEntryBody = (entry: { body?: string }) => entry.body ?? "";

export const getEntryHref = (entry: LibraryEntry) => {
  switch (entry.data.collection) {
    case "grey-book":
      return withBase(`/grey-book/${entry.data.slug}`);
    case "a2-units":
      return withBase(`/a2/${entry.data.slug}`);
    case "resources":
      return withBase(`/resources/${entry.data.slug}`);
    case "speaking-missions":
      return withBase(`/speaking/${entry.data.slug}`);
    default:
      return withBase("/");
  }
};

export const getCollectionHref = (collection: string) => {
  switch (collection) {
    case "grey-book":
      return withBase("/grey-book");
    case "a2-units":
      return withBase("/a2");
    case "resources":
      return withBase("/resources/grammar-reference");
    case "speaking-missions":
      return withBase("/speaking");
    default:
      return withBase("/");
  }
};

export const getPrevNextEntries = <T extends OrderedEntry>(
  entries: T[],
  slug: string,
) => {
  const index = entries.findIndex((entry) => entry.data.slug === slug);

  return {
    previous: index > 0 ? entries[index - 1] : undefined,
    next: index >= 0 && index < entries.length - 1 ? entries[index + 1] : undefined,
  };
};

export const uniqueValues = (entries: LibraryEntry[], field: "level") =>
  [...new Set(entries.map((entry) => entry.data[field]))];

export const uniqueListValues = (
  entries: LibraryEntry[],
  field: "grammarFocus" | "topics",
) =>
  [...new Set(entries.flatMap((entry) => entry.data[field]))].sort((left, right) =>
    left.localeCompare(right),
  );
