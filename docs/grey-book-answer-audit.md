# Grey's Book Answer Preview Audit

## Current result

The shared answer key is aligned with all 12 visible chapter lessons.

For every chapter, the answer preview now follows the same sequence:

1. `Understanding`
2. `Fun Activities`
3. `Grammar Practice`

The content audit confirms that every published chapter receives an answer snippet, that the snippet begins with `Understanding`, and that the number of understanding answers matches the visible questions.

## Chapter coverage

| Chapters | Understanding | Fun Activities | Grammar Practice |
|---|---|---|---|
| 1–4 | Aligned | Aligned | Aligned |
| 5–8 | Aligned | Aligned | Aligned |
| 9–10 | Aligned | Aligned | Aligned |
| 11–12 | Aligned | Aligned | Aligned |

Chapters 11 and 12 were checked explicitly after their addition. Their telephone-handover and plan-change activities, grammar labels, and fixed answers match the visible lesson prompts.

## Learner contract

- Fixed-answer exercises must have a corresponding answer.
- Open creative tasks use models or success criteria rather than automatic grading.
- The preview must not expose an activity that is absent from the chapter.
- Labels should describe the same activity on the page and in the answer key.

## Maintenance rule

Run `pnpm audit:content` after changing a Grey's Book prompt, activity label, fixed answer, or chapter section. Add a focused post-change audit when meaning changes even if the structural gate remains green.
