export const NAV_LINKS = [
  { href: "/learn", label: "Learn", ltLabel: "Mokytis" },
  { href: "/grey-book", label: "Grey's Book", ltLabel: "Grey knyga" },
  { href: "/a2", label: "A2 Course", ltLabel: "A2 kursas" },
  { href: "/speaking", label: "Speaking", ltLabel: "Kalbėjimas" },
  { href: "/resources", label: "Resources", ltLabel: "Ištekliai" },
] as const;

export const REVEAL_SECTION_PATTERN =
  /exercise|pratimas|questions|activities|grammar practice|grammar exercises|speaking practice|fun activities|answer key/i;

export const GREY_ANSWER_SLUG = "grey-book";
export const A2_ANSWER_SLUG = "a2";

export const withBasePath = (path: string, base = "/") => {
  if (!path.startsWith("/") || path.startsWith("//")) {
    return path;
  }

  if (path === "/") {
    return base;
  }

  return `${base.replace(/\/$/, "")}${path}`;
};

export const withBase = (path: string) =>
  withBasePath(path, import.meta.env?.BASE_URL || "/");
