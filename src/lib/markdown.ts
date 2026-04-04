import { marked } from "marked";

import { REVEAL_SECTION_PATTERN } from "./constants";

export type ParsedSection = {
  id: string;
  title: string;
  titleHtml: string;
  html: string;
  collapsible: boolean;
};

export type ParsedDocument = {
  excerpt: string;
  introHtml: string;
  sections: ParsedSection[];
};

const LITHUANIAN_HINTS =
  /\b(skyrius|pratimas|mokymosi|pagrindinis|gramatika|veiksmažodis|naudingi|kultūrinės|papildomos|atsakymų|žodyno|skaitymo|kalbėjimo|vertimas|patarimai|būtasis|esamasis|ateities|ligoninė|maistas|kelionės|kartojimas|įvadas|lyginamieji|pradžia|tėvo|širdis|tikrovė|svajonės|mokytojas|gydytojas|draugas|ačiū|viso|laba|labas|malonu|susipažinti|vakar|rytoj)\b/i;

const markdownRenderer = new marked.Renderer();

marked.setOptions({
  gfm: true,
  breaks: false,
});

export const slugify = (value: string) =>
  value
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/&/g, "and")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

const stripMarkdown = (value: string) =>
  value
    .replace(/`([^`]+)`/g, "$1")
    .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
    .replace(/[*_>#]/g, "")
    .trim();

const looksLithuanian = (value: string) =>
  /[ąčęėįšųūž]/i.test(value) || LITHUANIAN_HINTS.test(value);

const wrapLithuanian = (value: string) =>
  `<span class="lt-text">${value.trim()}</span>`;

const transformParentheticalGlosses = (line: string) =>
  line.replace(/\(([^)]+)\)/g, (full, inner) =>
    looksLithuanian(inner) ? wrapLithuanian(`(${inner})`) : full,
  );

const transformSlashLabel = (text: string) => {
  const slashIndex = text.indexOf(" / ");

  if (slashIndex === -1) {
    return text;
  }

  const primary = text.slice(0, slashIndex);
  const secondary = text.slice(slashIndex + 3);

  return looksLithuanian(secondary)
    ? `${primary} ${wrapLithuanian(`/ ${secondary}`)}`
    : text;
};

const transformBulletTranslation = (line: string) => {
  const match = line.match(/^(\s*[-*]\s+.+?)(\s[—-]\s)(.+)$/);

  if (!match) {
    return line;
  }

  const [, left, separator, right] = match;
  return looksLithuanian(right)
    ? `${left}${separator}${wrapLithuanian(right)}`
    : line;
};

const transformLine = (line: string) => {
  const headingMatch = line.match(/^(#{1,6}\s+)(.+)$/);

  if (headingMatch) {
    const [, prefix, text] = headingMatch;
    const transformed = transformParentheticalGlosses(transformSlashLabel(text));
    return looksLithuanian(text) ? `${prefix}${wrapLithuanian(text)}` : `${prefix}${transformed}`;
  }

  return transformParentheticalGlosses(
    transformBulletTranslation(transformSlashLabel(line)),
  );
};

export const renderMarkdown = (markdown: string) =>
  marked.parse(markdown.split("\n").map(transformLine).join("\n"), {
    renderer: markdownRenderer,
  }) as string;

const stripLeadingTitleLines = (markdown: string, title: string, ltTitle: string) => {
  const lines = markdown.split("\n");
  const output: string[] = [];
  let skippedTitle = false;
  let skippedLtTitle = false;

  for (const line of lines) {
    const trimmed = line.trim();

    if (!skippedTitle && /^#{1,2}\s+/.test(trimmed) && stripMarkdown(trimmed.replace(/^#{1,2}\s+/, "")) === title) {
      skippedTitle = true;
      continue;
    }

    if (!skippedLtTitle && /^#{1,2}\s+/.test(trimmed) && stripMarkdown(trimmed.replace(/^#{1,2}\s+/, "")) === ltTitle) {
      skippedLtTitle = true;
      continue;
    }

    output.push(line);
  }

  return output.join("\n").replace(/^\s+/, "");
};

const getSectionLevel = (markdown: string) => {
  const hasH2 = /^##\s+/m.test(markdown);
  return hasH2 ? 2 : 3;
};

const splitSections = (markdown: string, level: number) => {
  const lines = markdown.split("\n");
  const sections: Array<{ title: string; markdown: string }> = [];
  let introLines: string[] = [];
  let currentTitle: string | null = null;
  let currentLines: string[] = [];
  const headingPrefix = "#".repeat(level);
  const headingPattern = new RegExp(`^${headingPrefix}\\s+(.+)$`);

  for (const line of lines) {
    const headingMatch = line.match(headingPattern);

    if (headingMatch) {
      if (currentTitle) {
        sections.push({
          title: currentTitle,
          markdown: currentLines.join("\n").trim(),
        });
      }

      currentTitle = headingMatch[1].trim();
      currentLines = [];
      continue;
    }

    if (currentTitle) {
      currentLines.push(line);
    } else {
      introLines.push(line);
    }
  }

  if (currentTitle) {
    sections.push({
      title: currentTitle,
      markdown: currentLines.join("\n").trim(),
    });
  }

  return {
    introMarkdown: introLines.join("\n").trim(),
    sections,
  };
};

const getExcerpt = (markdown: string) => {
  const text = markdown
    .replace(/^#{1,6}\s+/gm, "")
    .replace(/[*_`>-]/g, "")
    .replace(/\[(.*?)\]\(.*?\)/g, "$1")
    .replace(/\s+/g, " ")
    .trim();

  return text.slice(0, 180).trim() + (text.length > 180 ? "..." : "");
};

export const parseDocument = ({
  markdown,
  title,
  ltTitle,
}: {
  markdown: string;
  title: string;
  ltTitle: string;
}) => {
  const normalized = stripLeadingTitleLines(markdown, title, ltTitle);
  const sectionLevel = getSectionLevel(normalized);
  const { introMarkdown, sections } = splitSections(normalized, sectionLevel);
  const excerptSource =
    introMarkdown || sections.find((section) => section.markdown)?.markdown || normalized;

  return {
    excerpt: getExcerpt(excerptSource),
    introHtml: introMarkdown ? renderMarkdown(introMarkdown) : "",
    sections: sections.map((section) => ({
      id: slugify(stripMarkdown(section.title)),
      title: stripMarkdown(section.title),
      titleHtml: transformLine(section.title),
      html: renderMarkdown(section.markdown),
      collapsible: REVEAL_SECTION_PATTERN.test(section.title),
    })),
  } satisfies ParsedDocument;
};
