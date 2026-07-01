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

const REQUIRED_MISSION_STEPS = ["brief", "prep", "speak", "compare", "reflect"];

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
    frontmatter,
    data: {
      title: readFrontmatterScalar(frontmatter, "title"),
      ltTitle: readFrontmatterScalar(frontmatter, "ltTitle"),
      slug: readFrontmatterScalar(frontmatter, "slug"),
      order: Number(readFrontmatterScalar(frontmatter, "order")),
      hasAnswerKey: readFrontmatterScalar(frontmatter, "hasAnswerKey") === "true",
      sourceRefs: readFrontmatterList(frontmatter, "sourceRefs"),
      supportsRecording:
        readFrontmatterScalar(frontmatter, "supportsRecording") === "true",
    },
  };
};

const lineNumberAt = (value, index) => value.slice(0, index).split(/\r?\n/).length;

const primaryHeading = (value) => value.split(/\s+\/\s+/)[0].trim();

const markdownWordCount = (value) =>
  value
    .replace(/<[^>]+>/g, " ")
    .replace(/\[[^\]]+\]\([^)]+\)/g, " ")
    .replace(/[`*_#>|]/g, " ")
    .trim()
    .split(/\s+/)
    .filter(Boolean).length;

const bulletCount = (value) => [...value.matchAll(/^\s*[-*]\s+\S/gm)].length;

const numberedItemCount = (value) => [...value.matchAll(/^\s*\d+\.\s+\S/gm)].length;

const thirdLevelSectionBody = (body, primaryTitle) => {
  const matches = [...body.matchAll(/^###\s+(.+?)\s*$/gm)];
  const index = matches.findIndex((match) => primaryHeading(match[1]) === primaryTitle);

  if (index === -1) {
    return "";
  }

  const start = matches[index].index + matches[index][0].length;
  const end = matches[index + 1]?.index ?? body.length;
  return body.slice(start, end).trim();
};

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
    path.join(root, "a2-practice-workbook.md"),
    path.join(root, "a2-lithuanian-error-clinic.md"),
    path.join(root, "a2-real-life-phrasebook.md"),
    path.join(root, "a2-listening-dictation-pack.md"),
    path.join(root, "a2-couples-conversation-pack.md"),
    path.join(root, "a2-workplace-english-pack.md"),
    path.join(root, "a2-travel-english-pack.md"),
    path.join(root, "a2-services-english-pack.md"),
    path.join(root, "a2-vocabulary-game-bank.md"),
    path.join(root, "a2-30-day-study-plan.md"),
    path.join(root, "a2-self-study-routes.md"),
    path.join(root, "a2-partner-study-guide.md"),
    path.join(root, "a2-can-do-portfolio.md"),
  ];

  const units = unitFiles.map((filePath) => ({ filePath, document: load(filePath) }));
  const greyChapters = greyFiles.map((filePath) => ({ filePath, document: load(filePath) }));
  const speakingMissions = speakingFiles.map((filePath) => ({ filePath, document: load(filePath) }));
  const resources = resourceFiles.map((filePath) => ({ filePath, document: load(filePath) }));

  if (units.length !== 24) {
    errors.push(`course scope: expected 24 A2 units, found ${units.length}`);
  }

  if (greyChapters.length !== 12) {
    errors.push(`course scope: expected 12 Grey's Book chapters, found ${greyChapters.length}`);
  }

  if (speakingMissions.length !== 24) {
    errors.push(`course scope: expected 24 speaking missions, found ${speakingMissions.length}`);
  }

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

    if (occurrences.size < 8) {
      report(filePath, `lesson needs at least 8 numbered exercises, found ${occurrences.size}`);
    }

    const lessonWords = markdownWordCount(document.body);
    if (lessonWords < 1_200) {
      report(filePath, `lesson is too thin for guided self-study (${lessonWords} words; minimum 1200)`);
    }

    const objectiveHeading = document.body.match(
      /^#{2,4}\s+Learning Objectives\b[^\n]*$/mi,
    );
    const objectiveBody = objectiveHeading
      ? document.body
          .slice(objectiveHeading.index + objectiveHeading[0].length)
          .split(/^#{2,4}\s+/m)[0]
      : "";
    const objectiveCount = bulletCount(objectiveBody);
    if (objectiveCount < 3) {
      report(filePath, `Learning Objectives needs at least 3 concrete outcomes, found ${objectiveCount}`);
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
    const greyAnswerHeadingLines = [
      ...greyAnswers.body.matchAll(/^###\s+(Chapter\s+\d+\s+.+?)\s*$/gim),
    ];
    const greyAnswerHeadingCounts = new Map();
    for (const heading of greyAnswerHeadingLines) {
      const normalized = heading[1].replace(/\s+/g, " ").trim().toLowerCase();
      greyAnswerHeadingCounts.set(normalized, (greyAnswerHeadingCounts.get(normalized) ?? 0) + 1);
    }
    for (const [heading, count] of greyAnswerHeadingCounts) {
      if (count > 1) {
        report(greyAnswerPath, `answer heading “${heading}” is repeated ${count} times`);
      }
    }

    for (const { filePath, document } of greyChapters) {
      if (!document?.data.hasAnswerKey) {
        continue;
      }

      const snippet = extractGreyAnswerSnippet(greyAnswers, document);

      if (!snippet) {
        report(filePath, `no answer snippet found for Chapter ${document.data.order}`);
      } else if (!/^###\s+Understanding\b/im.test(snippet)) {
        report(filePath, "answer snippet does not begin with a normalized Understanding heading");
      } else {
        const questionCount = numberedItemCount(
          thirdLevelSectionBody(document.body, "Understanding Questions"),
        );
        const answerCount = numberedItemCount(
          thirdLevelSectionBody(snippet, "Understanding"),
        );

        if (answerCount !== questionCount) {
          report(
            filePath,
            `Understanding answer count ${answerCount} does not match ${questionCount} questions`,
          );
        }
      }
    }
  }

  for (const { filePath, document } of greyChapters) {
    if (!document) {
      continue;
    }

    const storyMatch = document.body.match(
      /^###\s+Story\s*\r?\n([\s\S]*?)^###\s+Understanding Questions\s*$/m,
    );

    if (!storyMatch) {
      report(filePath, "Story section is missing or cannot be measured");
    } else {
      const storyWords = storyMatch[1]
        .replace(/<[^>]+>/g, " ")
        .replace(/[*_`>#|\[\]()]/g, " ")
        .trim()
        .split(/\s+/)
        .filter(Boolean).length;

      if (storyWords < 700 || storyWords > 1200) {
        report(
          filePath,
          `Story section has ${storyWords} words; expected 700–1200`,
        );
      }
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

    const phrasalVerbCount = bulletCount(
      thirdLevelSectionBody(document.body, "Phrasal Verbs"),
    );
    const wordBankCount = bulletCount(thirdLevelSectionBody(document.body, "Word Bank"));
    const understandingCount = numberedItemCount(
      thirdLevelSectionBody(document.body, "Understanding Questions"),
    );
    const creativeCount = numberedItemCount(
      thirdLevelSectionBody(document.body, "Creative Questions"),
    );
    const activityCount = [
      ...thirdLevelSectionBody(document.body, "Fun Activities").matchAll(
        /^####\s+Activity\s+\d+\b/gim,
      ),
    ].length;

    if (phrasalVerbCount !== 5) {
      report(filePath, `Phrasal Verbs needs exactly 5 entries, found ${phrasalVerbCount}`);
    }
    if (wordBankCount < 12 || wordBankCount > 20) {
      report(filePath, `Word Bank needs 12–20 core entries, found ${wordBankCount}`);
    }
    if (understandingCount < 8 || understandingCount > 10) {
      report(filePath, `Understanding Questions needs 8–10 items, found ${understandingCount}`);
    }
    if (creativeCount < 5) {
      report(filePath, `Creative Questions needs at least 5 scaffolded prompts, found ${creativeCount}`);
    }
    if (activityCount < 2) {
      report(filePath, `Fun Activities needs at least 2 distinct activities, found ${activityCount}`);
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

    const stepKinds = [
      ...document.frontmatter.matchAll(
        /^\s{2}-\s+kind:\s+["']?([^"'\s]+)["']?\s*$/gm,
      ),
    ].map((match) => match[1]);
    if (JSON.stringify(stepKinds) !== JSON.stringify(REQUIRED_MISSION_STEPS)) {
      report(
        filePath,
        `mission steps must be ${REQUIRED_MISSION_STEPS.join(" → ")}; found ${stepKinds.join(" → ") || "none"}`,
      );
    }

    if (!document.data.supportsRecording) {
      report(filePath, "speaking mission must support the record-and-compare loop");
    }

    const supportSectionCount = [...document.body.matchAll(/^##\s+\S/gm)].length;
    if (supportSectionCount < 2) {
      report(
        filePath,
        `speaking mission needs at least 2 rendered support sections, found ${supportSectionCount}`,
      );
    }

    const compareStart = document.frontmatter.match(
      /^\s{2}-\s+kind:\s+["']?compare["']?\s*$/m,
    );
    let comparePrompt = "";
    if (compareStart) {
      const remainder = document.frontmatter.slice(compareStart.index + compareStart[0].length);
      const nextStepIndex = remainder.search(/^\s{2}-\s+kind:/m);
      const compareBlock = nextStepIndex >= 0 ? remainder.slice(0, nextStepIndex) : remainder;
      comparePrompt = compareBlock.match(/^\s+prompt:\s+(.+?)\s*$/m)?.[1] ?? "";
    }
    const modelWords = markdownWordCount(stripQuotes(comparePrompt));
    if (modelWords < 20) {
      report(
        filePath,
        `compare step needs a usable spoken model of at least 20 words, found ${modelWords}`,
      );
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
