import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { validatePracticeCatalog } from "../src/lib/practice/schema.ts";
import {
  createPracticeCatalog,
  defaultRoot,
  loadPracticeSources,
  renderPracticeCatalog,
} from "./build-practice.mjs";

export const checkPracticeCatalog = ({ root = defaultRoot } = {}) => {
  const outputPath = path.join(root, "src", "generated", "practice-catalog.json");

  if (!existsSync(outputPath)) {
    throw new Error(
      `${path.relative(root, outputPath)} is missing; run the practice generator first.`,
    );
  }

  const sources = loadPracticeSources({ root, requireComplete: true });
  const expectedCatalog = createPracticeCatalog(sources);
  const expected = renderPracticeCatalog(expectedCatalog);
  const actual = readFileSync(outputPath, "utf8");

  let parsed;

  try {
    parsed = JSON.parse(actual);
  } catch (error) {
    throw new Error(
      `${path.relative(root, outputPath)} contains invalid JSON: ${error.message}`,
    );
  }

  validatePracticeCatalog(parsed);

  if (actual !== expected) {
    throw new Error(
      `${path.relative(root, outputPath)} is stale; regenerate it from practice/sources.`,
    );
  }

  return {
    catalog: expectedCatalog,
    outputPath,
    itemCount: expectedCatalog.units.reduce(
      (total, unit) => total + unit.items.length,
      0,
    ),
  };
};

const isDirectRun =
  process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);

if (isDirectRun) {
  try {
    const result = checkPracticeCatalog();
    console.log(
      `Practice catalog is current: ${result.catalog.units.length} units, ${result.itemCount} items.`,
    );
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  }
}
