# Grey's Book Answer Preview Audit

## Reader-level finding

- The Grey's Book reader uses one shared answer extractor per chapter. If the answer key contains outdated `Fun Activities` or `Grammar Practice` sections, the chapter page will still show them in the answer preview even when the chapter page does not expose matching exercises.

## Chapter-by-chapter alignment

### Chapter 1

- Visible chapter sections and answer preview sections align: understanding, fun activities, and grammar practice are all present.

### Chapter 2

- The answer key contains `Fun Activities`, but the visible chapter page does not include a `Fun Activities` section.
- The chapter does include `Grammar Practice`, but it is placed before the story, which weakens answer-preview expectations.

### Chapter 3

- The answer key contains `Fun Activities` and `Grammar Practice`.
- The visible chapter page stops after `Creative Questions`.
- The answer preview therefore exposes content that the learner cannot see or complete on the chapter page.

### Chapter 4

- The visible chapter page includes `Fun Activities` with seven numbered activities.
- The answer key only covers Activity 1, Activity 2, Activity 3, and Activity 6.
- The answer key also contains `Grammar Practice`, but the visible chapter page does not expose a grammar practice section.

### Chapter 5

- The visible chapter page includes seven numbered activities plus grammar practice.
- The answer key only covers Activity 2, Activity 4, Activity 5, and Activity 6.
- Activity 1, Activity 3, and Activity 7 are visible in the chapter but currently have no corresponding answer coverage.

### Chapter 6

- The answer key contains `Fun Activities` and `Grammar Practice`.
- The visible chapter page contains only understanding and creative questions after the story.
- The answer preview therefore reveals exercises that are absent from the chapter page.

### Chapter 7

- The answer key contains `Fun Activities` and `Grammar Practice`.
- The visible chapter page does not expose those sections.
- The answer preview is therefore broader than the visible lesson.

### Chapter 8

- The answer key contains `Fun Activities` and `Grammar Practice`.
- The visible chapter page does not expose those sections.
- The answer preview is therefore broader than the visible lesson.

### Chapter 9

- Section coverage is broadly aligned: understanding, fun activities, and grammar content all exist.
- The chapter uses `Grammar Exercises`, while the answer key uses `Grammar Practice`, so the learner sees a naming mismatch between page and preview.

### Chapter 10

- Section coverage is broadly aligned: understanding, fun activities, and grammar content all exist.
- The chapter uses `Grammar Exercises`, while the answer key uses `Grammar Practice`, so the reader still sees a naming mismatch.

## Priority fixes suggested by the audit

- Reconcile Chapters 3, 6, 7, and 8 first, because their answer previews currently expose sections that do not exist on the chapter page.
- Reconcile Chapter 4 and Chapter 5 next, because visible activities are only partially covered by the shared answers.
- Normalize `Grammar Exercises` versus `Grammar Practice` naming in Chapters 9 and 10.
- After content cleanup, tighten the answer-preview UI so it reflects only sections that are actually present in the visible lesson.
