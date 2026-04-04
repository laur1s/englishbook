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

const LITHUANIAN_CHARACTER_PATTERN = /[ąčęėįšųūž]/i;
const LITHUANIAN_WORD_HINTS =
  /\b(rytas|diena|vakaras|ligoninė|mokytojas|gydytojas|pacientas|valgykla|chirurgija|skausmas|kraujas|kambarys|šeima|draugas|sąžiningas|misija|kelionė|širdis|audra|brolis|sesuo|operacija|klausimas|atsakymas|atsibusti|apsivilkti|užsiregistruoti|prižiūrėti|nusiraminti|nemalonus|ataskaitos|pabusti|rezidentas|praktikantas|viršininkas|rūbinė|išsekęs|nervinga|blužnis|mėlynė)\b/i;

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
    .replace(/^[a-z]\)\s*/i, "")
    .replace(/^\((.*)\)$/,"$1")
    .replace(/\s+/g, " ")
    .trim();

const looksLithuanian = (value: string) =>
  LITHUANIAN_CHARACTER_PATTERN.test(value) || LITHUANIAN_WORD_HINTS.test(value);

const looksLikeLowercaseGloss = (value: string) =>
  /[a-z]/.test(value) &&
  value === value.toLowerCase() &&
  !/\b(example|answer|doctor|patient|simple|continuous|grammar|word bank|activity|true|false)\b/i.test(value);

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

const trailingEnglishVariants = (value: string) => {
  const words = normalizeEnglish(value).split(" ").filter(Boolean);
  const variants = new Set<string>();

  for (let length = 1; length <= Math.min(3, words.length); length += 1) {
    const candidate = words.slice(-length).join(" ");

    if (candidate && !ENGLISH_STOP_WORDS.has(candidate)) {
      variants.add(candidate);
    }
  }

  return [...variants];
};

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

  const english = match[1];
  const rightSide = match[2];
  const parentheticalTranslation = rightSide.match(/\(([^)\n]+)\)\s*$/)?.[1];
  const lithuanian = parentheticalTranslation && (looksLithuanian(parentheticalTranslation) || looksLikeLowercaseGloss(parentheticalTranslation))
    ? parentheticalTranslation
    : looksLithuanian(rightSide)
      ? rightSide
      : null;

  if (!lithuanian) {
    return null;
  }

  return { english, lithuanian };
};

const extractParentheticalGlosses = (line: string) => {
  const pairs: Array<{ english: string; lithuanian: string }> = [];
  const pattern = /([A-Za-z][A-Za-z' -]{1,40}?)\s*\(([^)\n]{2,60})\)/g;

  for (const match of line.matchAll(pattern)) {
    const english = match[1].trim();
    const lithuanian = match[2].trim();

    if (english && (looksLithuanian(lithuanian) || looksLikeLowercaseGloss(lithuanian))) {
      for (const variant of trailingEnglishVariants(english)) {
        pairs.push({ english: variant, lithuanian });
      }
    }
  }

  return pairs;
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

    pairs.push(...extractParentheticalGlosses(line));
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
