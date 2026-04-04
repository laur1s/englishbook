import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";

type TranslationDictionary = Record<string, string[]>;

const repoRoot = process.cwd();

const sourceFiles = [
  ...readdirSync(path.join(repoRoot, "Grey's book"))
    .filter((file: string) => /^chapter-\d+\.md$/.test(file))
    .map((file: string) => path.join(repoRoot, "Grey's book", file)),
  ...readdirSync(repoRoot)
    .filter((file: string) => /^unit-\d+.*\.md$/.test(file))
    .map((file: string) => path.join(repoRoot, file)),
  path.join(repoRoot, "grammar-reference.md"),
  path.join(repoRoot, "vocabulary-lists.md"),
];

const ENGLISH_STOP_WORDS = new Set([
  "a",
  "an",
  "and",
  "the",
  "to",
  "of",
  "or",
  "for",
  "in",
  "on",
  "at",
  "with",
  "from",
]);

const stripFrontmatter = (value: string) => value.replace(/^---[\s\S]*?---\s*/, "");

const normalizeEnglish = (value: string) =>
  value
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[`*_"]/g, "")
    .replace(/\([^)]*\)/g, "")
    .replace(/\.\.\./g, "")
    .replace(/(^[^a-z]+|[^a-z]+$)/g, "")
    .replace(/\s+/g, " ")
    .trim();

const normalizeLithuanian = (value: string) =>
  value
    .replace(/[`*_"]/g, "")
    .replace(/\s+/g, " ")
    .trim();

const singularize = (value: string) => {
  if (value.endsWith("ies") && value.length > 4) {
    return `${value.slice(0, -3)}y`;
  }

  if (value.endsWith("es") && value.length > 4) {
    return value.slice(0, -2);
  }

  if (value.endsWith("s") && value.length > 3) {
    return value.slice(0, -1);
  }

  return value;
};

const splitEnglishVariants = (value: string) =>
  value
    .split(/\s*\/\s*|\s*,\s*/)
    .map(normalizeEnglish)
    .filter(Boolean)
    .filter((item) => !ENGLISH_STOP_WORDS.has(item));

const addEntry = (dictionary: Map<string, Set<string>>, english: string, lithuanian: string) => {
  const normalizedEnglish = normalizeEnglish(english);
  const normalizedLithuanian = normalizeLithuanian(lithuanian);

  if (!normalizedEnglish || !normalizedLithuanian) {
    return;
  }

  const variants = new Set<string>([
    normalizedEnglish,
    singularize(normalizedEnglish),
    ...splitEnglishVariants(normalizedEnglish),
  ]);

  for (const variant of variants) {
    if (!variant || ENGLISH_STOP_WORDS.has(variant)) {
      continue;
    }

    if (!dictionary.has(variant)) {
      dictionary.set(variant, new Set());
    }

    dictionary.get(variant)?.add(normalizedLithuanian);
  }
};

const extractBulletTranslation = (line: string) => {
  const match = line.match(/^\s*[-*]\s+(.+?)\s(?:—|-)\s(.+?)\s*$/);

  if (!match) {
    return null;
  }

  return {
    english: match[1],
    lithuanian: match[2],
  };
};

const extractTranslationPairs = (markdown: string) => {
  const cleaned = stripFrontmatter(markdown);
  const lines = cleaned.split("\n");
  const pairs: Array<{ english: string; lithuanian: string }> = [];

  for (const line of lines) {
    const bulletPair = extractBulletTranslation(line);

    if (bulletPair) {
      pairs.push(bulletPair);
      continue;
    }

    const sentencePair = line.match(/^\s*\d+\.\s+(.+?)\s(?:—|-)\s(.+?)\s*$/);

    if (sentencePair) {
      pairs.push({
        english: sentencePair[1],
        lithuanian: sentencePair[2],
      });
    }
  }

  return pairs;
};

let cachedDictionary: TranslationDictionary | null = null;

export const getTranslationDictionary = () => {
  if (cachedDictionary) {
    return cachedDictionary;
  }

  const dictionary = new Map<string, Set<string>>();

  for (const filePath of sourceFiles) {
    const content = readFileSync(filePath, "utf8");

    for (const pair of extractTranslationPairs(content)) {
      addEntry(dictionary, pair.english, pair.lithuanian);
    }
  }

  cachedDictionary = Object.fromEntries(
    [...dictionary.entries()]
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, values]) => [key, [...values].sort((left, right) => left.localeCompare(right))]),
  );

  return cachedDictionary;
};
