# English A2 Book Maintenance Guide

## Project scope

English learning library for Lithuanian speakers with:

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

## Quality gates

Before describing the project as release-ready, run:

1. `pnpm audit:content`
2. `pnpm test`
3. `pnpm check`
4. `pnpm build`
5. Browser smoke tests for home, collection filters, one lesson, one answer deep link, and one speaking mission on desktop and mobile.

The Markdown course is the source of truth. The site must not display empty lesson panels, stale answers, invalid translations, or draft content.

## Publishing status

The complete A2 learning sequence is present and usable. It remains an actively maintained digital course: answer alignment, language accuracy, accessibility, and rendered mobile behaviour must pass the gates above after every material change. Do not call it print-ready unless a separate print artifact and print-layout review have been completed.
