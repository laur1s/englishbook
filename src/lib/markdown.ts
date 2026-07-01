import { marked } from "marked";

import { REVEAL_SECTION_PATTERN, withBase } from "./constants.ts";

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
const renderLink = markdownRenderer.link.bind(markdownRenderer);
const renderImage = markdownRenderer.image.bind(markdownRenderer);

const escapeHtml = (value: string) =>
  value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");

const ALLOWED_URL_SCHEMES = new Set(["http", "https", "mailto", "tel"]);

const decodeUrlCharacterReferences = (value: string) => {
  let invalidCodePoint = false;
  const decodeNumericReference = (reference: string, code: string, radix: number) => {
    const codePoint = Number.parseInt(code, radix);
    const isUnicodeScalar = Number.isInteger(codePoint) &&
      codePoint >= 0 &&
      codePoint <= 0x10ffff &&
      !(codePoint >= 0xd800 && codePoint <= 0xdfff);

    if (!isUnicodeScalar) {
      invalidCodePoint = true;
      return reference;
    }

    return String.fromCodePoint(codePoint);
  };

  const decoded = value
    .replace(/&#(\d+);?/g, (reference, code) => decodeNumericReference(reference, code, 10))
    .replace(/&#x([\da-f]+);?/gi, (reference, code) => decodeNumericReference(reference, code, 16))
    .replace(/&colon;/gi, ":")
    .replace(/&tab;/gi, "\t")
    .replace(/&newline;/gi, "\n")
    .replace(/&amp;/gi, "&");

  return invalidCodePoint ? null : decoded;
};

const isSafeMarkdownUrl = (value: string) => {
  const decodedHref = decodeUrlCharacterReferences(value);
  if (decodedHref === null) return false;
  const href = decodedHref.trim();

  if (!href || href.startsWith("//")) {
    return false;
  }

  const compactPrefix = href.slice(0, 64).replace(/[\u0000-\u0020\u007f]+/g, "");
  const scheme = compactPrefix.match(/^([a-z][a-z0-9+.-]*):/i)?.[1]?.toLowerCase();

  return !scheme || ALLOWED_URL_SCHEMES.has(scheme);
};

const sanitizeAllowedRawTag = (tag: string) => {
  if (/^<\/?(?:strong|em)>$/i.test(tag) || /^<br\s*\/?>$/i.test(tag)) {
    return tag.toLowerCase();
  }

  if (/^<\/(?:p|span)>$/i.test(tag)) {
    return tag.toLowerCase();
  }

  if (/^<(?:p|span) class=(?:"lt-text"|'lt-text') lang=(?:"lt"|'lt')>$/i.test(tag)) {
    const element = tag.match(/^<(p|span)\b/i)?.[1]?.toLowerCase();
    return element ? `<${element} class="lt-text" lang="lt">` : escapeHtml(tag);
  }

  return escapeHtml(tag);
};

const sanitizeRawHtml = (value: string) => {
  let output = "";
  let cursor = 0;

  for (const match of value.matchAll(/<[^>]*>/g)) {
    const index = match.index ?? 0;
    output += escapeHtml(value.slice(cursor, index));
    output += sanitizeAllowedRawTag(match[0]);
    cursor = index + match[0].length;
  }

  return output + escapeHtml(value.slice(cursor));
};

markdownRenderer.link = (token) => {
  if (!isSafeMarkdownUrl(token.href)) {
    return escapeHtml(token.text);
  }

  return renderLink({
    ...token,
    href: token.href.startsWith("/") ? withBase(token.href) : token.href,
  });
};

markdownRenderer.image = (token) => {
  if (!isSafeMarkdownUrl(token.href)) {
    return escapeHtml(token.text);
  }

  return renderImage({
    ...token,
    href: token.href.startsWith("/") ? withBase(token.href) : token.href,
  });
};

markdownRenderer.html = (token) => sanitizeRawHtml(token.text);

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
  `<span class="lt-text" lang="lt">${value.trim()}</span>`;

const transformParentheticalGlosses = (line: string) =>
  line.replace(/\(([^)]+)\)/g, (full, inner) =>
    looksLithuanian(inner) ? wrapLithuanian(`(${inner})`) : full,
  );

const transformSlashLabel = (text: string) => {
  const slashIndex = text.lastIndexOf(" / ");

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
    return `${prefix}${transformHeadingTitle(text)}`;
  }

  return transformParentheticalGlosses(
    transformBulletTranslation(transformSlashLabel(line)),
  );
};

const transformHeadingTitle = (title: string) => {
  if (looksLithuanian(title)) {
    const slashIndex = title.lastIndexOf(" / ");

    if (slashIndex === -1) {
      return wrapLithuanian(title);
    }
  }

  return transformParentheticalGlosses(transformSlashLabel(title));
};

const getPrimaryHeadingTitle = (title: string) => {
  const slashIndex = title.lastIndexOf(" / ");

  if (slashIndex === -1 || !looksLithuanian(title.slice(slashIndex + 3))) {
    return title;
  }

  return title.slice(0, slashIndex);
};

const wrapScrollableTables = (html: string) =>
  html.replace(
    /(<table(?:\s[^>]*)?>)([\s\S]*?<\/table>)/g,
    '<div class="table-scroll" role="region" aria-label="Scrollable table" tabindex="0">$1$2</div>',
  );

export const renderMarkdown = (markdown: string) =>
  wrapScrollableTables(
    marked.parse(markdown.split("\n").map(transformLine).join("\n"), {
      renderer: markdownRenderer,
    }) as string,
  );

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

  const hasContent = (lines: string[]) => lines.some((line) => line.trim().length > 0);
  const isBilingualHeadingPair = (englishTitle: string, lithuanianTitle: string) =>
    !looksLithuanian(englishTitle) && looksLithuanian(lithuanianTitle);

  const pushCurrentSection = () => {
    if (!currentTitle || !hasContent(currentLines)) {
      return;
    }

    sections.push({
      title: currentTitle,
      markdown: currentLines.join("\n").trim(),
    });
  };

  for (const line of lines) {
    const headingMatch = line.match(headingPattern);

    if (headingMatch) {
      if (currentTitle) {
        if (!hasContent(currentLines) && isBilingualHeadingPair(currentTitle, headingMatch[1])) {
          currentTitle = `${currentTitle} / ${headingMatch[1].trim()}`;
          continue;
        }

        pushCurrentSection();
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

  pushCurrentSection();

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
      id: slugify(stripMarkdown(getPrimaryHeadingTitle(section.title))),
      title: stripMarkdown(section.title),
      titleHtml: sanitizeRawHtml(transformHeadingTitle(section.title)),
      html: renderMarkdown(section.markdown),
      collapsible: REVEAL_SECTION_PATTERN.test(section.title),
    })),
  } satisfies ParsedDocument;
};
