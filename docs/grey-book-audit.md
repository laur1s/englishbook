# Grey's Book Audit

## Current result

All 12 published chapters match the canonical learner-facing structure:

1. `Phrasal Verbs`
2. `Word Bank`
3. `Story`
4. `Understanding Questions`
5. `Creative Questions`
6. `Fun Activities`
7. `Grammar Practice`

The content audit verifies that every chapter has each section exactly once and in this order. It also checks story length, word-bank size, question counts, activity coverage, unique rendered section IDs, non-empty panels, and matching understanding-answer counts.

## Reader-level verification

- The hero shows `Chapter n of 12`.
- Previous, next, and collection navigation are present.
- The page outline links to every section and the answer preview.
- Wide tables use keyboard-focusable horizontal scrolling.
- The active study loop saves four pieces of reading evidence on the device.
- Exercise and answer sections stay collapsed until the learner opens them.
- Desktop and mobile layouts preserve readable text, navigation, and table access.

## Chapter coverage

| Chapters | Structure | Navigation | Study loop | Rendered panels |
|---|---|---|---|---|
| 1–4 | Pass | Pass | Pass | Pass |
| 5–8 | Pass | Pass | Pass | Pass |
| 9–10 | Pass | Pass | Pass | Pass |
| 11–12 | Pass | Pass | Pass | Pass |

## Maintenance rule

Run `pnpm audit:content` after every Grey's Book edit. A chapter is not considered aligned when a canonical section is missing, duplicated, out of order, empty, or unsupported by its answer preview.
