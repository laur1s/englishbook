export const NAV_LINKS = [
  { href: "/", label: "Home", ltLabel: "Pradžia" },
  { href: "/grey-book", label: "Grey's Book", ltLabel: "Grey knyga" },
  { href: "/a2", label: "A2 Course", ltLabel: "A2 kursas" },
  { href: "/answers/a2", label: "Answer Keys", ltLabel: "Atsakymų raktai" },
] as const;

export const REVEAL_SECTION_PATTERN =
  /exercise|pratimas|questions|activities|grammar practice|grammar exercises|speaking practice|fun activities|answer key/i;

export const GREY_ANSWER_SLUG = "grey-book";
export const A2_ANSWER_SLUG = "a2";

export const withBase = (path: string) => {
  const base = import.meta.env.BASE_URL || "/";

  if (path === "/") {
    return base;
  }

  return `${base.replace(/\/$/, "")}${path}`;
};
