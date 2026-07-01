# English Library

A story-led A2 English course for Lithuanian speakers. The project combines a 12-unit course, a ten-chapter hospital story, short speaking rehearsals, bilingual support, grammar and vocabulary references, and answer keys in one Astro website.

## Start learning

Choose the route that matches your goal:

- **Build a reading habit:** begin with *Grey's Book* and read the chapters in order.
- **Study systematically:** work through A2 Units 1–12.
- **Speak more:** use a Speaking Lab mission after its related unit.
- **Review a weak point:** open the grammar or vocabulary reference, then return to the lesson.

### A useful 20-minute study loop

1. Read the examples and say two of them aloud.
2. Hide the Lithuanian notes and recall the meaning in English.
3. Complete one exercise without opening the answer key.
4. Make three true sentences about your own life.
5. Check your answers, correct one mistake, and retry it the next day.

The site saves lesson and speaking progress only in the current browser. No account is required.

## Course map

### A2.1 foundations

1. Greetings and introductions
2. Daily routines and Present Simple
3. Past Simple and personal history
4. Food and shopping
5. Travel and directions
6. Future plans

### A2.2 development

7. Present Perfect
8. Comparatives and superlatives
9. Modal verbs
10. Present-tense contrast
11. Past Continuous
12. Review and consolidation

## Run the website locally

Requirements: Node.js 22.12 or newer and pnpm.

```bash
pnpm install --frozen-lockfile
pnpm dev
```

Before publishing a content or code change, run:

```bash
pnpm qa
```

This runs Astro diagnostics, helper regression tests, the content-integrity audit, and a production build. The GitHub Pages workflow runs the same gates.

## Project structure

- `unit-*.md` — A2 lessons
- `Grey's book/chapter-*.md` — story chapters
- `speaking/*.md` — guided speaking missions
- `answer-key.md` and `Grey's book/answers.md` — answer keys
- `grammar-reference.md` and `vocabulary-lists.md` — reference material
- `src/` — Astro pages, layouts, components, and learning interactions
- `scripts/` — automated content-quality checks

## Editorial standard

Keep explanations at A2 level, qualify language-use advice instead of using unsafe absolutes, and give Lithuanian help only where it supports understanding. Every fixed-answer exercise must have a matching key; open tasks should include a model or a short success checklist.
