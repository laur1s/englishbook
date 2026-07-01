# English A2 Book Maintenance Guide

## Project scope

English learning library for Lithuanian speakers with:

- A 12-module, 60-session continuous learning path
- Deterministic interactive practice and spaced review
- A2.1 Units 1–6
- A2.2 Units 7–12
- Grey's Book reading track
- Speaking Lab missions
- A2 and Grey's Book answer keys
- Grammar and vocabulary references
- Astro learner website

## Editorial requirements

- Keep learner instructions and model language at CEFR A2 unless a later form is clearly labelled.
- Use natural Lithuanian support; avoid literal translations that would teach an error.
- Do not force one answer when context permits several. Add context or mark alternatives as valid.
- Every fixed-answer exercise needs a matching answer-key entry.
- Every open writing or speaking task needs a model, sentence starter, or success checklist.
- Prefer qualified usage notes over rules containing “always” or “never.”
- Preserve the grammar progression from Units 1–12.
- Keep interactive items self-contained, unambiguous, bilingual, and tied to a real lesson exercise.
- Preserve stable session, objective, and item IDs; increment revisions when meaning or answers change.
- Never auto-grade open writing or speaking. Use a model and self-check criteria instead.

## Quality gates

Before describing the project as release-ready, run:

1. `pnpm audit:content`
2. `pnpm practice:check`
3. `pnpm test`
4. `pnpm check`
5. `pnpm build`
6. Browser smoke tests for the learning dashboard, one content session, choice and fill-blank scoring, saved resume, one cumulative checkpoint, home, one lesson, and one speaking mission on desktop and mobile.

Markdown remains the source of truth for long lessons. `learning/course-path.json` is the source of truth for order, and `practice/sources/*.json` is the source of truth for scored interactive items. The site must not display empty lesson panels, stale answers, invalid translations, draft content, or a stale generated practice catalog.

## Publishing status

The complete A2 learning sequence is present and usable. It remains an actively maintained digital course: answer alignment, language accuracy, accessibility, and rendered mobile behaviour must pass the gates above after every material change. Do not call it print-ready unless a separate print artifact and print-layout review have been completed.
