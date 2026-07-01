# English Library

A continuous A2 English learning system for Lithuanian speakers. The project combines a 60-session linear path, deterministic interactive practice, spaced review, a 12-unit course, a ten-chapter story, speaking rehearsals, bilingual support, reference guides, and answer keys in one Astro website.

## Start learning

Open **Your English Path** and follow the next recommended session. Each of the 12 modules uses the same five-step loop:

1. **Context** — meet the language in a story or focused reference.
2. **Learn** — study the complete unit with Lithuanian support.
3. **Practice** — answer one interactive item at a time and use bilingual feedback.
4. **Speak** — complete a short rehearsal mission.
5. **Review** — retrieve important language again and schedule the next review.

The library routes remain available when you want to explore: *Grey's Book* for reading, A2 Course for deep study, Speaking for rehearsal, and Resources for quick reference.

### A useful 20-minute study loop

1. Read the examples and say two of them aloud.
2. Hide the Lithuanian notes and recall the meaning in English.
3. Complete one exercise without opening the answer key.
4. Make three true sentences about your own life.
5. Check your answers, correct one mistake, and retry it the next day.

The site saves the exact session, responses, attempts, skill strength, and review dates only in the current browser. No account is required.

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

This runs Astro diagnostics, regression tests, the content-integrity audit, the compiled-practice integrity check, and a production build. The GitHub Pages workflow runs the same gates.

## Produce and validate more interactive practice

Interactive questions are curated in `practice/sources/`. They are compiled into a deterministic catalog, so learners can request fresh packs without an API and the same attempt can always be reproduced.

```bash
pnpm practice:generate  # validate sources and rebuild the catalog
pnpm practice:check     # fail if the catalog is invalid or stale
pnpm practice:stats     # show coverage by unit, type, and difficulty
```

Add new items with stable IDs, explicit answers, English and Lithuanian rationales, difficulty, and a source reference. Never generate scored questions by scraping the prose answer keys. A source change must pass `pnpm qa` before publishing.

## Project structure

- `unit-*.md` — A2 lessons
- `Grey's book/chapter-*.md` — story chapters
- `speaking/*.md` — guided speaking missions
- `learning/course-path.json` — 12 modules and 60 ordered sessions
- `practice/sources/*.json` — reviewed interactive question banks
- `src/generated/practice-catalog.json` — reproducible compiled practice catalog
- `answer-key.md` and `Grey's book/answers.md` — answer keys
- `grammar-reference.md` and `vocabulary-lists.md` — reference material
- `src/` — Astro pages, layouts, components, and learning interactions
- `scripts/` — automated content-quality checks

## Editorial standard

Keep explanations at A2 level, qualify language-use advice instead of using unsafe absolutes, and give Lithuanian help only where it supports understanding. Every fixed-answer exercise must have a matching key; every interactive item must have an unambiguous answer and bilingual rationale; open tasks should use a model or a short success checklist instead of automatic scoring.
