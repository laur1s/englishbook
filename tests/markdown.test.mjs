import assert from "node:assert/strict";
import test from "node:test";

import { parseDocument, renderMarkdown } from "../src/lib/markdown.ts";

test("adjacent English and Lithuanian headings form one populated section", () => {
  const parsed = parseDocument({
    markdown: `# Unit 1: Test

## Skyrius 1: Testas

### Learning Objectives / Mokymosi tikslai

- Learn one thing.

## Exercise 1: Choose the answer
## Pratimas 1: Pasirinkite atsakymą

1. Choose A or B.

## Empty heading

## Part 2: Review

Review the answer.`,
    title: "Unit 1: Test",
    ltTitle: "Skyrius 1: Testas",
  });

  assert.equal(parsed.sections.length, 2);
  assert.equal(
    parsed.sections[0].title,
    "Exercise 1: Choose the answer / Pratimas 1: Pasirinkite atsakymą",
  );
  assert.equal(parsed.sections[0].id, "exercise-1-choose-the-answer");
  assert.match(parsed.sections[0].titleHtml, /class="lt-text" lang="lt"/);
  assert.match(parsed.sections[0].html, /Choose A or B/);
  assert.equal(parsed.sections.some((section) => section.title === "Empty heading"), false);
  assert.equal(parsed.sections.every((section) => section.html.trim().length > 0), true);
});

test("standalone Lithuanian section titles are hideable", () => {
  const parsed = parseDocument({
    markdown: "## Pratimas: Kartojimas\n\nPakartokite taisyklę.",
    title: "Review",
    ltTitle: "Kartojimas",
  });

  assert.equal(parsed.sections.length, 1);
  assert.equal(
    parsed.sections[0].titleHtml,
    '<span class="lt-text" lang="lt">Pratimas: Kartojimas</span>',
  );
});

test("Markdown tables receive a focusable scrolling region", () => {
  const html = renderMarkdown("| A | B |\n| --- | --- |\n| 1 | 2 |");

  assert.match(
    html,
    /<div class="table-scroll" role="region" aria-label="Scrollable table" tabindex="0"><table>/,
  );
  assert.match(html, /<\/table><\/div>/);
});
