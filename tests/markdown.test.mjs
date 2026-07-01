import assert from "node:assert/strict";
import test from "node:test";

import { parseDocument, renderMarkdown } from "../src/lib/markdown.ts";
import { withBasePath } from "../src/lib/constants.ts";

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

test("root-relative content links can be scoped to a deployed base path", () => {
  assert.equal(
    withBasePath("/resources/a2-practice-workbook", "/englishbook/"),
    "/englishbook/resources/a2-practice-workbook",
  );
  assert.equal(withBasePath("https://example.com/resource", "/englishbook/"), "https://example.com/resource");
  assert.match(
    renderMarkdown("[Practice](/resources/a2-practice-workbook)"),
    /href="\/resources\/a2-practice-workbook"/,
  );
});

test("unsafe Markdown URL schemes are rendered as text instead of links or images", () => {
  const html = renderMarkdown([
    "[bad link](javascript:alert(1))",
    "[encoded bad link](&#x6a;avascript&colon;alert(1))",
    "[bad data](data:text/html,unsafe)",
    "![bad image](data:image/svg+xml,unsafe)",
  ].join("\n\n"));

  assert.doesNotMatch(html, /href=(?:"|')(?:javascript|data):/i);
  assert.doesNotMatch(html, /src=(?:"|')data:/i);
  assert.match(html, /bad link/);
  assert.match(html, /encoded bad link/);
  assert.match(html, /bad data/);
  assert.match(html, /bad image/);
});

test("out-of-range numeric URL entities are rejected without aborting rendering", () => {
  let html = "";
  assert.doesNotThrow(() => {
    html = renderMarkdown([
      "[decimal overflow](https://example.com/&#1114112;)",
      "[hex surrogate](https://example.com/&#xD800;)",
      "![huge numeric image](https://example.com/&#999999999999999999999999999999;)",
    ].join("\n\n"));
  });

  assert.match(html, /decimal overflow/);
  assert.match(html, /hex surrogate/);
  assert.match(html, /huge numeric image/);
  assert.doesNotMatch(html, /<a\b/i);
  assert.doesNotMatch(html, /<img\b/i);
});

test("raw scripts, frames, and event handlers cannot reach rendered HTML", () => {
  const html = renderMarkdown([
    '<script>alert("unsafe")</script>',
    '<iframe src="https://example.com"></iframe>',
    '<img src="x" onerror="alert(1)">',
    '<p class="lt-text" lang="lt" onclick="alert(1)">Unsafe note</p>',
  ].join("\n"));

  assert.doesNotMatch(html, /<\/?(?:script|iframe|img)\b/i);
  assert.doesNotMatch(html, /<[^>]*\son\w+=/i);
  assert.match(html, /&lt;script&gt;/);
  assert.match(html, /Unsafe note/);
});

test("the raw HTML allowlist preserves Lithuanian support markup only", () => {
  const html = renderMarkdown(
    '<p class="lt-text" lang="lt"><strong>Lietuviška atrama:</strong> <em>pavyzdys</em>.</p>',
  );

  assert.match(html, /<p class="lt-text" lang="lt">/);
  assert.match(html, /<strong>Lietuviška atrama:<\/strong>/);
  assert.match(html, /<em>pavyzdys<\/em>/);
});
