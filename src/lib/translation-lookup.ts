export type TranslationDictionary = Record<string, string[]>;

export type TranslationLookup = {
  key: string;
  matchedTerm: string;
  translations: string[];
};

export type TranslationMatch = TranslationLookup & {
  start: number;
  end: number;
};

export const MAX_LOOKUP_WORDS = 4;

const WORD_PATTERN = /[A-Za-z]+(?:['’-][A-Za-z]+)*/g;

export const normalizeLookupTerm = (value: string) =>
  value
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/(^[^a-z]+|[^a-z]+$)/g, "")
    .replace(/\s+/g, " ")
    .trim();

export const getLookupCandidates = (value: string) => {
  const normalized = normalizeLookupTerm(value);
  const variants = [normalized];
  const words = normalized.split(" ").filter(Boolean);
  const finalWord = words.at(-1) ?? "";

  const addFinalWordVariant = (replacement: string) => {
    variants.push([...words.slice(0, -1), replacement].join(" "));
  };

  if (finalWord.endsWith("ies") && finalWord.length > 4) {
    addFinalWordVariant(`${finalWord.slice(0, -3)}y`);
  }

  if (finalWord.endsWith("es") && finalWord.length > 4) {
    addFinalWordVariant(finalWord.slice(0, -2));
  }

  if (finalWord.endsWith("s") && finalWord.length > 3) {
    addFinalWordVariant(finalWord.slice(0, -1));
  }

  return [...new Set(variants.filter(Boolean))];
};

export const lookupTranslation = (
  terms: string[],
  dictionary: TranslationDictionary,
): TranslationLookup | null => {
  for (const term of terms) {
    for (const candidate of getLookupCandidates(term)) {
      const translations = dictionary[candidate];

      if (translations?.length) {
        return {
          key: candidate,
          matchedTerm: term,
          translations,
        };
      }
    }
  }

  return null;
};

export const findTranslationMatches = (
  text: string,
  dictionary: TranslationDictionary,
  maxWords = MAX_LOOKUP_WORDS,
) => {
  const tokens = [...text.matchAll(WORD_PATTERN)].map((match) => ({
    start: match.index,
    end: match.index + match[0].length,
  }));
  const matches: TranslationMatch[] = [];

  for (let tokenIndex = 0; tokenIndex < tokens.length;) {
    let matched: TranslationMatch | null = null;
    let matchedWordCount = 0;
    const longestCandidate = Math.min(maxWords, tokens.length - tokenIndex);

    for (let wordCount = longestCandidate; wordCount >= 1; wordCount -= 1) {
      const candidateTokens = tokens.slice(tokenIndex, tokenIndex + wordCount);
      const hasOnlySpaceSeparators = candidateTokens.every((token, index) => {
        const nextToken = candidateTokens[index + 1];
        return !nextToken || /^\s+$/.test(text.slice(token.end, nextToken.start));
      });

      if (!hasOnlySpaceSeparators) {
        continue;
      }

      const start = candidateTokens[0].start;
      const end = candidateTokens.at(-1)?.end ?? start;
      const visibleTerm = text.slice(start, end);
      const lookup = lookupTranslation([visibleTerm], dictionary);

      if (lookup) {
        matched = { ...lookup, start, end };
        matchedWordCount = wordCount;
        break;
      }
    }

    if (matched) {
      matches.push(matched);
      tokenIndex += matchedWordCount;
    } else {
      tokenIndex += 1;
    }
  }

  return matches;
};
