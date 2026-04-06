# Chapter 3 Answer Bundle Audit

## Visible lesson shape

Chapter 3 currently exposes these learner-facing sections:

1. `Phrasal Verbs`
2. `Word Bank`
3. `Story`
4. `Understanding Questions`
5. `Creative Questions`

The current chapter page does not expose:

- `Fun Activities`
- `Grammar Practice`

## Shared answer bundle shape

The shared answer key currently includes all of these Chapter 3 answer bundles:

- `Chapter 3 Understanding`
- `Chapter 3 Fun Activities`
- `Chapter 3 Grammar Practice`

## Mismatch

- The answer preview for Chapter 3 can expose `Fun Activities` and `Grammar Practice` answers that do not exist on the visible chapter page.
- This breaks the reader contract established in `docs/grey-book-chapter-structure.md`, where answer preview content should only reflect sections that exist in the lesson.
- The current mismatch is structural, not just editorial. The answer key assumes a fuller lesson shape than the chapter currently provides.

## Implication for follow-up work

- Task 24 should restore Chapter 3 support sections to the canonical lesson shape instead of trimming the answer key first.
- Once the chapter has visible `Fun Activities` and `Grammar Practice`, the shared answer bundle can remain valid with minimal or no further adjustment.
