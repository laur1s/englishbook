import { createHash } from "node:crypto";
import {
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  writeFileSync,
} from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import {
  PRACTICE_GENERATOR_VERSION,
  PRACTICE_SCHEMA_VERSION,
  PracticeValidationError,
  validatePracticeCatalog,
  validatePracticeSource,
} from "../src/lib/practice/schema.ts";

const scriptDirectory = path.dirname(fileURLToPath(import.meta.url));
export const defaultRoot = path.resolve(scriptDirectory, "..");
export const EXPECTED_UNIT_IDS = Array.from(
  { length: 12 },
  (_, index) => `unit-${String(index + 1).padStart(2, "0")}`,
);

const compareText = (left, right) => left.localeCompare(right, "en");

const normalizeSource = (source) => ({
  schemaVersion: source.schemaVersion,
  unitId: source.unitId,
  contentVersion: source.contentVersion,
  title: source.title.trim(),
  objectives: [...source.objectives]
    .sort((left, right) => compareText(left.id, right.id))
    .map((objective) => ({
      id: objective.id,
      label: {
        en: objective.label.en.trim(),
        lt: objective.label.lt.trim(),
      },
    })),
  items: [...source.items]
    .sort((left, right) => compareText(left.id, right.id))
    .map((item) => {
      const common = {
        id: item.id,
        revision: item.revision,
        objectiveId: item.objectiveId,
        type: item.type,
        difficulty: item.difficulty,
        prompt: {
          en: item.prompt.en.trim(),
          lt: item.prompt.lt.trim(),
        },
      };
      const answerSpecific = item.type === "single-choice"
        ? {
            choices: [...item.choices]
              .sort((left, right) => compareText(left.id, right.id))
              .map((choice) => ({ id: choice.id, text: choice.text.trim() })),
            answer: { choiceId: item.answer.choiceId },
          }
        : {
            answer: {
              accepted: [...item.answer.accepted]
                .map((answer) => answer.trim())
                .sort(compareText),
              caseSensitive: item.answer.caseSensitive,
            },
          };

      return {
        ...common,
        ...answerSpecific,
        rationale: {
          en: item.rationale.en.trim(),
          lt: item.rationale.lt.trim(),
        },
        sourceRefs: [...item.sourceRefs]
          .sort((left, right) =>
            compareText(left.lesson, right.lesson) || left.exercise - right.exercise,
          )
          .map((sourceRef) => ({ ...sourceRef })),
      };
    }),
});

const exerciseNumbersForLesson = (root, lesson) => {
  const candidates = readdirSync(root).filter(
    (fileName) =>
      fileName.endsWith(".md") &&
      (fileName === `${lesson}.md` || fileName.startsWith(`${lesson}-`)),
  );

  if (candidates.length !== 1) {
    return {
      fileName: candidates[0] ?? "",
      numbers: new Set(),
      issue: candidates.length === 0
        ? `no Markdown lesson found for ${lesson}`
        : `multiple Markdown lessons found for ${lesson}: ${candidates.join(", ")}`,
    };
  }

  const fileName = candidates[0];
  const markdown = readFileSync(path.join(root, fileName), "utf8");
  const numbers = new Set(
    [...markdown.matchAll(/^#{2,6}\s+Exercise\s+(\d+)\b/gim)].map((match) => Number(match[1])),
  );

  return { fileName, numbers, issue: "" };
};

const validateSourceSet = (sources, root, { requireComplete }) => {
  const issues = [];
  const unitIds = new Set(sources.map((source) => source.unitId));

  if (requireComplete) {
    for (const expectedId of EXPECTED_UNIT_IDS) {
      if (!unitIds.has(expectedId)) {
        issues.push(`practice/sources: missing ${expectedId}.json`);
      }
    }

    for (const unitId of unitIds) {
      if (!EXPECTED_UNIT_IDS.includes(unitId)) {
        issues.push(`practice/sources: unexpected unit “${unitId}”`);
      }
    }
  }

  const globalObjectiveIds = new Set();
  const globalItemIds = new Set();

  for (const source of sources) {
    const referencedObjectives = new Set(source.items.map((item) => item.objectiveId));
    const types = new Set(source.items.map((item) => item.type));
    const lessonAudit = exerciseNumbersForLesson(root, source.unitId);

    if (lessonAudit.issue) {
      issues.push(`${source.unitId}: ${lessonAudit.issue}`);
    }

    if (!types.has("single-choice") || !types.has("fill-blank")) {
      issues.push(`${source.unitId}: must include both single-choice and fill-blank items`);
    }

    for (const objective of source.objectives) {
      if (!referencedObjectives.has(objective.id)) {
        issues.push(`${source.unitId}: objective “${objective.id}” has no items`);
      }

      if (globalObjectiveIds.has(objective.id)) {
        issues.push(`${source.unitId}: duplicate global objective ID “${objective.id}”`);
      }

      globalObjectiveIds.add(objective.id);
    }

    for (const item of source.items) {
      if (globalItemIds.has(item.id)) {
        issues.push(`${source.unitId}: duplicate global item ID “${item.id}”`);
      }

      globalItemIds.add(item.id);

      for (const sourceRef of item.sourceRefs) {
        if (!lessonAudit.numbers.has(sourceRef.exercise)) {
          issues.push(
            `${source.unitId}: item “${item.id}” references missing Exercise ${sourceRef.exercise}`,
          );
        }
      }
    }
  }

  if (issues.length) {
    throw new PracticeValidationError(issues);
  }
};

export const loadPracticeSources = ({
  root = defaultRoot,
  requireComplete = true,
} = {}) => {
  const sourceDirectory = path.join(root, "practice", "sources");

  if (!existsSync(sourceDirectory)) {
    throw new Error(`Practice source directory does not exist: ${sourceDirectory}`);
  }

  const fileNames = readdirSync(sourceDirectory)
    .filter((fileName) => fileName.endsWith(".json"))
    .sort(compareText);
  const sources = fileNames.map((fileName) => {
    const filePath = path.join(sourceDirectory, fileName);
    let parsed;

    try {
      parsed = JSON.parse(readFileSync(filePath, "utf8"));
    } catch (error) {
      throw new Error(`${path.relative(root, filePath)}: invalid JSON: ${error.message}`);
    }

    const source = validatePracticeSource(parsed, path.relative(root, filePath));

    if (fileName !== `${source.unitId}.json`) {
      throw new PracticeValidationError([
        `${path.relative(root, filePath)}: filename must be ${source.unitId}.json`,
      ]);
    }

    return normalizeSource(source);
  });

  sources.sort((left, right) => compareText(left.unitId, right.unitId));
  validateSourceSet(sources, root, { requireComplete });
  return sources;
};

export const createPracticeCatalog = (sources) => {
  const normalizedSources = sources
    .map((source, index) => normalizeSource(validatePracticeSource(source, `source[${index}]`)))
    .sort((left, right) => compareText(left.unitId, right.unitId));
  const sourceJson = JSON.stringify(normalizedSources);
  const sourceHash = `sha256-${createHash("sha256").update(sourceJson).digest("hex")}`;
  const catalog = {
    schemaVersion: PRACTICE_SCHEMA_VERSION,
    generatorVersion: PRACTICE_GENERATOR_VERSION,
    sourceHash,
    units: normalizedSources,
  };

  return validatePracticeCatalog(catalog);
};

export const renderPracticeCatalog = (catalog) => `${JSON.stringify(catalog, null, 2)}\n`;

export const buildPracticeCatalog = ({ root = defaultRoot } = {}) => {
  const sources = loadPracticeSources({ root, requireComplete: true });
  const catalog = createPracticeCatalog(sources);
  const outputPath = path.join(root, "src", "generated", "practice-catalog.json");
  const rendered = renderPracticeCatalog(catalog);

  mkdirSync(path.dirname(outputPath), { recursive: true });
  writeFileSync(outputPath, rendered, "utf8");

  return { catalog, outputPath, rendered };
};

const isDirectRun =
  process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);

if (isDirectRun) {
  try {
    const { catalog, outputPath } = buildPracticeCatalog();
    const itemCount = catalog.units.reduce((total, unit) => total + unit.items.length, 0);
    console.log(
      `Generated ${path.relative(defaultRoot, outputPath)} with ${catalog.units.length} units and ${itemCount} items.`,
    );
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  }
}
