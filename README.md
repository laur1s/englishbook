# English Library

A continuous A2 English learning system for Lithuanian speakers. The project combines a 120-session guided path, deterministic interactive practice, spaced review, 24 units, a twelve-chapter story, speaking rehearsals, bilingual support, reference guides, and answer keys in one Astro website.

## Start learning

Open **Your English Path** and follow the next recommended session. Each of the 24 modules uses the same five-step loop:

1. **Context** — meet the language in a story or focused reference.
2. **Learn** — study the complete unit with Lithuanian support.
3. **Practice** — answer an adaptive set, use bilingual feedback, and repair every missed answer before moving on.
4. **Speak** — listen to a model, record a private in-browser take, compare, and repeat.
5. **Review** — retrieve important language again; due and weak skills are automatically prioritised.

The library routes remain available when you want to explore: *Grey's Book* for reading, A2 Course for deep study, Speaking for rehearsal, and Resources for quick reference.

### A useful 20-minute study loop

1. Read the examples and say two of them aloud.
2. Hide the Lithuanian notes and recall the meaning in English.
3. Complete one exercise without opening the answer key.
4. Make three true sentences about your own life.
5. Check your answers, correct one mistake, and retry it the next day.

The dashboard turns this sequence into a daily plan with a minutes goal, seven-day momentum, named review skills, and recent mistakes to revisit. Fresh deterministic packs can be created repeatedly from nearly 400 reviewed questions, so practice continues after the linear path is complete.

The site saves the exact session, responses, attempts, skill strength, review dates, activity, and preferences only in the current browser. Speaking audio is never uploaded or persisted. No account is required.

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

### A2.3–A2.4 extension library

13. Determiners and everyday objects
14. Pronouns and personal connections
15. Home and responsibilities
16. Health and wellbeing
17. Weather, clothes, and plans
18. Work, study, and learning
19. Technology and communication
20. Invitations and social plans
21. Nature and the environment
22. Services and problem-solving
23. People, places, and relative clauses
24. A2 communication project

`A2.1` through `A2.4` are internal sequence labels, not separate official CEFR levels. All 24 units belong to the tracked five-step path and include scored interactive practice, answer coverage, and speaking missions. Cumulative checkpoints follow Units 3, 6, 9, 12, 15, 18, 21, and 24.

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

Each course-path session also has an independent `revision` (default `1`). Bump only the changed session when learners should complete that step again; unrelated completed sessions stay complete.

## Project structure

- `unit-*.md` — A2 lessons
- `Grey's book/chapter-*.md` — story chapters
- `speaking/*.md` — guided speaking missions
- `learning/course-path.json` — 24 modules and 120 ordered sessions
- `practice/sources/*.json` — reviewed interactive question banks
- `src/generated/practice-catalog.json` — reproducible compiled practice catalog
- `answer-key.md` and `Grey's book/answers.md` — answer keys
- `grammar-reference.md` and `vocabulary-lists.md` — reference material
- `src/` — Astro pages, layouts, components, and learning interactions
- `scripts/` — automated content-quality checks

## Editorial standard

Keep explanations at A2 level, qualify language-use advice instead of using unsafe absolutes, and give Lithuanian help only where it supports understanding. Every fixed-answer exercise must have a matching key; every interactive item must have an unambiguous answer and bilingual rationale; open tasks should use a model or a short success checklist instead of automatic scoring.
