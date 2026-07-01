import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import {
  extractA2AnswerSnippet,
  extractGreyAnswerSnippet,
} from "../src/lib/answers.ts";
import { parseDocument } from "../src/lib/markdown.ts";

const scriptDirectory = path.dirname(fileURLToPath(import.meta.url));
const defaultRoot = path.resolve(scriptDirectory, "..");

const GREY_CHAPTER_SECTIONS = [
  "Phrasal Verbs",
  "Word Bank",
  "Story",
  "Understanding Questions",
  "Creative Questions",
  "Fun Activities",
  "Grammar Practice",
];

const stripQuotes = (value) => {
  const trimmed = value.trim();

  if (
    (trimmed.startsWith('"') && trimmed.endsWith('"')) ||
    (trimmed.startsWith("'") && trimmed.endsWith("'"))
  ) {
    return trimmed.slice(1, -1);
  }

  return trimmed;
};

const readFrontmatterScalar = (frontmatter, field) => {
  const match = frontmatter.match(new RegExp(`^${field}:\\s*(.+?)\\s*$`, "m"));
  return match ? stripQuotes(match[1]) : "";
};

const readFrontmatterList = (frontmatter, field) => {
  const lines = frontmatter.split(/\r?\n/);
  const start = lines.findIndex((line) => line.trim() === `${field}:`);

  if (start === -1) {
    return [];
  }

  const values = [];

  for (const line of lines.slice(start + 1)) {
    if (/^\S/.test(line)) {
      break;
    }

    const item = line.match(/^\s+-\s+(.+?)\s*$/);

    if (item) {
      values.push(stripQuotes(item[1]));
    }
  }

  return values;
};

const readMarkdownDocument = (filePath) => {
  const source = readFileSync(filePath, "utf8");
  const match = source.match(/^---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)/);

  if (!match) {
    throw new Error("missing YAML frontmatter");
  }

  const frontmatter = match[1];

  return {
    body: source.slice(match[0].length),
    data: {
      title: readFrontmatterScalar(frontmatter, "title"),
      ltTitle: readFrontmatterScalar(frontmatter, "ltTitle"),
      slug: readFrontmatterScalar(frontmatter, "slug"),
      order: Number(readFrontmatterScalar(frontmatter, "order")),
      hasAnswerKey: readFrontmatterScalar(frontmatter, "hasAnswerKey") === "true",
      sourceRefs: readFrontmatterList(frontmatter, "sourceRefs"),
    },
  };
};

const lineNumberAt = (value, index) => value.slice(0, index).split(/\r?\n/).length;

const primaryHeading = (value) => value.split(/\s+\/\s+/)[0].trim();

const numberedExerciseHeadings = (body) =>
  [...body.matchAll(/^#{2,6}\s+Exercise\s+(\d+)\b.*$/gim)].map((match) => ({
    number: Number(match[1]),
    line: lineNumberAt(body, match.index),
  }));

const listMarkdownFiles = (directory, pattern) =>
  readdirSync(directory)
    .filter((file) => pattern.test(file))
    .sort((left, right) => left.localeCompare(right))
    .map((file) => path.join(directory, file));

export const runContentAudit = ({ root = defaultRoot } = {}) => {
  const errors = [];
  const relative = (filePath) => path.relative(root, filePath);
  const report = (filePath, message) => errors.push(`${relative(filePath)}: ${message}`);
  const load = (filePath) => {
    try {
      return readMarkdownDocument(filePath);
    } catch (error) {
      report(filePath, error instanceof Error ? error.message : String(error));
      return null;
    }
  };

  const unitFiles = listMarkdownFiles(root, /^unit-\d+.*\.md$/);
  const greyFiles = listMarkdownFiles(path.join(root, "Grey's book"), /^chapter-\d+\.md$/);
  const speakingFiles = listMarkdownFiles(path.join(root, "speaking"), /^mission-.*\.md$/);
  const resourceFiles = [
    path.join(root, "grammar-reference.md"),
    path.join(root, "vocabulary-lists.md"),
  ];

  const units = unitFiles.map((filePath) => ({ filePath, document: load(filePath) }));
  const greyChapters = greyFiles.map((filePath) => ({ filePath, document: load(filePath) }));
  const speakingMissions = speakingFiles.map((filePath) => ({ filePath, document: load(filePath) }));
  const resources = resourceFiles.map((filePath) => ({ filePath, document: load(filePath) }));

  for (const { filePath, document } of units) {
    if (!document) {
      continue;
    }

    const occurrences = new Map();

    for (const exercise of numberedExerciseHeadings(document.body)) {
      const { number } = exercise;
      const lines = occurrences.get(number) ?? [];
      lines.push(exercise.line);
      occurrences.set(number, lines);
    }

    for (const [number, lines] of occurrences) {
      if (lines.length > 1) {
        report(filePath, `Exercise ${number} is repeated at body lines ${lines.join(", ")}`);
      }
    }
  }

  const a2AnswerPath = path.join(root, "answer-key.md");
  const greyAnswerPath = path.join(root, "Grey's book", "answers.md");
  const a2Answers = load(a2AnswerPath);
  const greyAnswers = load(greyAnswerPath);

  if (a2Answers) {
    for (const { filePath, document } of units) {
      if (!document?.data.hasAnswerKey) {
        continue;
      }

      const snippet = extractA2AnswerSnippet(a2Answers, document);

      if (!snippet) {
        report(filePath, `no answer snippet found for Unit ${document.data.order}`);
      } else if (/^##\s+Unit\b/im.test(snippet)) {
        report(filePath, "answer snippet still includes its duplicated outer Unit heading");
      } else {
        const lessonNumbers = new Set(
          numberedExerciseHeadings(document.body).map((exercise) => exercise.number),
        );
        const answerNumbers = new Set(
          numberedExerciseHeadings(snippet).map((exercise) => exercise.number),
        );
        const missingAnswers = [...lessonNumbers].filter((number) => !answerNumbers.has(number));
        const unexpectedAnswers = [...answerNumbers].filter((number) => !lessonNumbers.has(number));

        if (missingAnswers.length) {
          report(
            filePath,
            `answer key is missing numbered Exercise heading(s): ${missingAnswers.join(", ")}`,
          );
        }

        if (unexpectedAnswers.length) {
          report(
            filePath,
            `answer key has unexpected numbered Exercise heading(s): ${unexpectedAnswers.join(", ")}`,
          );
        }
      }
    }
  }

  if (greyAnswers) {
    for (const { filePath, document } of greyChapters) {
      if (!document?.data.hasAnswerKey) {
        continue;
      }

      const snippet = extractGreyAnswerSnippet(greyAnswers, document);

      if (!snippet) {
        report(filePath, `no answer snippet found for Chapter ${document.data.order}`);
      } else if (!/^###\s+Understanding\b/im.test(snippet)) {
        report(filePath, "answer snippet does not begin with a normalized Understanding heading");
      }
    }
  }

  for (const { filePath, document } of greyChapters) {
    if (!document) {
      continue;
    }

    const headings = [...document.body.matchAll(/^###\s+(.+?)\s*$/gm)].map((match) =>
      primaryHeading(match[1]),
    );
    const sectionPositions = [];

    for (const expected of GREY_CHAPTER_SECTIONS) {
      const positions = headings
        .map((heading, index) => (heading === expected ? index : -1))
        .filter((index) => index >= 0);

      if (positions.length !== 1) {
        report(
          filePath,
          `expected exactly one “${expected}” section, found ${positions.length}`,
        );
      } else {
        sectionPositions.push(positions[0]);
      }
    }

    if (
      sectionPositions.length === GREY_CHAPTER_SECTIONS.length &&
      sectionPositions.some((position, index) => index > 0 && position <= sectionPositions[index - 1])
    ) {
      report(filePath, "canonical Grey's Book sections are out of order");
    }
  }

  const unitSlugs = new Set(units.flatMap(({ document }) => (document?.data.slug ? [document.data.slug] : [])));

  for (const { filePath, document } of speakingMissions) {
    if (!document) {
      continue;
    }

    if (!document.data.sourceRefs.length) {
      report(filePath, "speaking mission has no sourceRefs");
      continue;
    }

    for (const sourceRef of document.data.sourceRefs) {
      if (!unitSlugs.has(sourceRef)) {
        report(filePath, `sourceRefs points to missing A2 unit “${sourceRef}”`);
      }
    }
  }

  const libraryDocuments = [...units, ...greyChapters, ...resources, ...speakingMissions];

  for (const { filePath, document } of libraryDocuments) {
    if (!document) {
      continue;
    }

    if (!document.data.title || !document.data.ltTitle) {
      report(filePath, "title or ltTitle is missing from frontmatter");
      continue;
    }

    const parsed = parseDocument({
      markdown: document.body,
      title: document.data.title,
      ltTitle: document.data.ltTitle,
    });
    const seenIds = new Set();

    if (!parsed.sections.length) {
      report(filePath, "document produces no rendered sections");
    }

    for (const section of parsed.sections) {
      if (!section.id) {
        report(filePath, `section “${section.title}” has an empty generated id`);
      } else if (seenIds.has(section.id)) {
        report(filePath, `section id “${section.id}” is duplicated`);
      }

      seenIds.add(section.id);

      if (!section.html.trim()) {
        report(filePath, `section “${section.title}” renders with an empty body`);
      }
    }
  }

  return {
    errors,
    counts: {
      units: units.length,
      greyChapters: greyChapters.length,
      resources: resources.length,
      speakingMissions: speakingMissions.length,
    },
  };
};

const isDirectRun = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);

if (isDirectRun) {
  const result = runContentAudit();

  if (result.errors.length) {
    console.error(`Content audit failed with ${result.errors.length} issue(s):`);
    result.errors.forEach((error) => console.error(`- ${error}`));
    process.exitCode = 1;
  } else {
    const { units, greyChapters, resources, speakingMissions } = result.counts;
    console.log(
      `Content audit passed: ${units} units, ${greyChapters} Grey chapters, ${resources} resources, ${speakingMissions} speaking missions.`,
    );
  }
}
