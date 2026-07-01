import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { validatePracticeCatalog } from "../src/lib/practice/schema.ts";
import { defaultRoot } from "./build-practice.mjs";

export const calculatePracticeStats = (catalog) =>
  catalog.units.map((unit) => {
    const choice = unit.items.filter((item) => item.type === "single-choice").length;
    const gaps = unit.items.filter((item) => item.type === "fill-blank").length;
    const difficulty = [1, 2, 3].map(
      (level) => unit.items.filter((item) => item.difficulty === level).length,
    );

    return {
      unit: unit.unitId,
      version: unit.contentVersion,
      objectives: unit.objectives.length,
      items: unit.items.length,
      choice,
      gaps,
      d1: difficulty[0],
      d2: difficulty[1],
      d3: difficulty[2],
    };
  });

export const readPracticeCatalog = ({ root = defaultRoot } = {}) => {
  const filePath = path.join(root, "src", "generated", "practice-catalog.json");
  return validatePracticeCatalog(JSON.parse(readFileSync(filePath, "utf8")));
};

const isDirectRun =
  process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);

if (isDirectRun) {
  try {
    const catalog = readPracticeCatalog();
    const stats = calculatePracticeStats(catalog);
    console.table(stats);
    console.log(
      `Total: ${stats.reduce((total, unit) => total + unit.items, 0)} items across ${stats.length} units.`,
    );
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  }
}
