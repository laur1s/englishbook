import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const scriptDirectory = path.dirname(fileURLToPath(import.meta.url));
const defaultRoot = path.resolve(scriptDirectory, "..", "dist");
const INTERNAL_ORIGIN = "https://english-library.invalid";
const githubRepositoryName = process.env.GITHUB_REPOSITORY?.split("/")[1];
const environmentBasePath = process.env.BASE_PATH ?? (
  process.env.GITHUB_ACTIONS === "true" && githubRepositoryName
    ? `/${githubRepositoryName}`
    : "/"
);

const decodeHtmlEntities = (value) =>
  value
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&#(\d+);/g, (_, code) => String.fromCodePoint(Number(code)))
    .replace(/&#x([\da-f]+);/gi, (_, code) => String.fromCodePoint(Number.parseInt(code, 16)));

export const normalizeBasePath = (value = "/") => {
  const trimmed = value.trim();
  if (!trimmed || trimmed === "/") return "/";
  return `/${trimmed.replace(/^\/+|\/+$/g, "")}/`;
};

const walkFiles = (directory) =>
  readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const filePath = path.join(directory, entry.name);
    return entry.isDirectory() ? walkFiles(filePath) : [filePath];
  });

const normalizeRoute = (value) => {
  const route = value.replace(/\/+/g, "/");
  if (route === "/" || route === "") return "/";
  return `/${route.replace(/^\/+|\/+$/g, "")}`;
};

const pageRoute = (rootDirectory, filePath) => {
  const relativePath = path.relative(rootDirectory, filePath).split(path.sep).join("/");
  if (relativePath === "index.html") return "/";
  if (relativePath.endsWith("/index.html")) {
    return `/${relativePath.slice(0, -"index.html".length)}`;
  }
  return `/${relativePath}`;
};

const routeLookupKey = (value) => normalizeRoute(value.replace(/\/index\.html$/i, ""));

const withBasePath = (route, basePath) => {
  if (basePath === "/") return route;
  if (route === "/") return basePath;
  return `${basePath.replace(/\/$/, "")}${route.startsWith("/") ? route : `/${route}`}`;
};

const stripBasePath = (pathname, basePath) => {
  if (basePath === "/") return pathname;
  const baseWithoutSlash = basePath.replace(/\/$/, "");
  if (pathname === baseWithoutSlash || pathname === basePath) return "/";
  return pathname.startsWith(basePath) ? `/${pathname.slice(basePath.length)}` : null;
};

const extractLinks = (html) =>
  [...html.matchAll(/<a\b[^>]*\bhref\s*=\s*(?:"([^"]*)"|'([^']*)')/gi)]
    .map((match) => decodeHtmlEntities(match[1] ?? match[2] ?? ""));

const extractIds = (html) => new Set(
  [...html.matchAll(/\bid\s*=\s*(?:"([^"]+)"|'([^']+)')/gi)]
    .map((match) => decodeHtmlEntities(match[1] ?? match[2] ?? "")),
);

export const checkSiteLinks = ({ rootDirectory = defaultRoot, basePath = "/" } = {}) => {
  const absoluteRoot = path.resolve(rootDirectory);
  const normalizedBase = normalizeBasePath(basePath);

  if (!existsSync(absoluteRoot) || !statSync(absoluteRoot).isDirectory()) {
    throw new Error(`Generated site directory does not exist: ${absoluteRoot}`);
  }

  const htmlFiles = walkFiles(absoluteRoot).filter((filePath) => filePath.endsWith(".html"));
  const pages = htmlFiles.map((filePath) => {
    const route = pageRoute(absoluteRoot, filePath);
    const html = readFileSync(filePath, "utf8");
    return { filePath, route, html, ids: extractIds(html) };
  });
  const pagesByRoute = new Map();

  pages.forEach((page) => {
    pagesByRoute.set(routeLookupKey(page.route), page);
    if (page.route.endsWith("/")) pagesByRoute.set(routeLookupKey(`${page.route}index.html`), page);
  });

  const issues = [];

  pages.forEach((page) => {
    const sourceUrl = new URL(withBasePath(page.route, normalizedBase), INTERNAL_ORIGIN);

    for (const href of extractLinks(page.html)) {
      if (!href || href.startsWith("//")) continue;

      let targetUrl;
      try {
        targetUrl = new URL(href, sourceUrl);
      } catch {
        issues.push({ source: page.route, href, reason: "invalid URL" });
        continue;
      }

      if (targetUrl.origin !== INTERNAL_ORIGIN) continue;

      const targetPath = stripBasePath(targetUrl.pathname, normalizedBase);
      if (targetPath === null) {
        issues.push({
          source: page.route,
          href,
          reason: `path escapes configured base ${normalizedBase}`,
        });
        continue;
      }

      const routeKey = routeLookupKey(targetPath);
      const targetPage = pagesByRoute.get(routeKey);

      if (!targetPage) {
        const relativeAssetPath = targetPath.replace(/^\//, "");
        const assetPath = path.resolve(absoluteRoot, relativeAssetPath);
        const insideRoot = assetPath === absoluteRoot || assetPath.startsWith(`${absoluteRoot}${path.sep}`);

        if (!insideRoot || !existsSync(assetPath)) {
          issues.push({ source: page.route, href, reason: "missing route or generated file" });
        }
        continue;
      }

      if (!targetUrl.hash || targetUrl.hash === "#") continue;

      let targetId;
      try {
        targetId = decodeURIComponent(targetUrl.hash.slice(1));
      } catch {
        issues.push({ source: page.route, href, reason: "invalid fragment encoding" });
        continue;
      }

      if (!targetPage.ids.has(targetId)) {
        issues.push({ source: page.route, href, reason: `missing fragment #${targetId}` });
      }
    }
  });

  return { pageCount: pages.length, issues };
};

const parseArguments = (arguments_) => {
  const options = {
    rootDirectory: defaultRoot,
    basePath: environmentBasePath,
  };

  for (let index = 0; index < arguments_.length; index += 1) {
    const argument = arguments_[index];
    if (argument === "--root") {
      options.rootDirectory = path.resolve(arguments_[index + 1] ?? "");
      index += 1;
    } else if (argument === "--base") {
      options.basePath = arguments_[index + 1] ?? "/";
      index += 1;
    } else {
      throw new Error(`Unknown argument: ${argument}`);
    }
  }

  return options;
};

const isDirectRun = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);

if (isDirectRun) {
  try {
    const result = checkSiteLinks(parseArguments(process.argv.slice(2)));
    if (result.issues.length) {
      console.error(`Generated-site link check found ${result.issues.length} issue(s):`);
      result.issues.forEach((issue) => {
        console.error(`- ${issue.source} -> ${issue.href}: ${issue.reason}`);
      });
      process.exitCode = 1;
    } else {
      console.log(`Generated-site link check passed for ${result.pageCount} HTML pages.`);
    }
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  }
}
