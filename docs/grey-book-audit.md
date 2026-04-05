# Grey's Book Audit

## Reader-level findings

- The chapter reader has stable previous/next navigation, but it does not provide a clear return path back to the Grey's Book collection.
- The chapter hero exposes level and grammar tags, but it does not show chapter sequence context such as `Chapter 3 of 10`.
- The table of contents reflects raw section headings only, so duplicated headings like `Word Bank` appear as repeated destinations without explanation.
- The reader treats all reveal sections the same; it does not distinguish between comprehension, activities, grammar practice, and answer preview.
- There is no visible reading-progress state on chapter pages yet, so the chapter flow is still easy to lose.

## Chapter-level findings

### Chapter 1

- Structure is broadly complete: phrasal verbs, word bank, story, comprehension, creative questions, activities, and grammar practice are present.
- This chapter is the current reference shape for a complete Grey's Book lesson.

### Chapter 2

- `Grammar Practice` appears before `Story`, breaking the sequence used by the stronger chapters.
- A second `Word Bank` appears at the end of the file, which will create a duplicated table-of-contents destination.
- The chapter structure feels out of order even before answer-key validation.

### Chapter 3

- A second `Word Bank` appears at the end of the file.
- The visible chapter structure stops after `Creative Questions`, even though the shared answers file includes `Fun Activities` and `Grammar Practice`.
- This chapter currently looks incomplete from the reader's point of view.

### Chapter 4

- The chapter includes a large activity block but ends with another `Word Bank`, which creates a duplicated content bucket at the end.
- The shared answers file includes `Grammar Practice`, but the chapter page itself does not currently expose that section.

### Chapter 5

- The chapter shape is mostly coherent and includes activities plus grammar practice.
- Activity numbering starts at `Activity 1`, but the answer key only covers a subset of the visible activities, which is a follow-up risk for answer alignment.

### Chapter 6

- The visible chapter ends after `Creative Questions`.
- The shared answers file still includes `Fun Activities` and `Grammar Practice`, so the lesson currently reads as truncated.
- This is one of the clearest chapter-to-answer mismatches in the book.

### Chapter 7

- The visible chapter ends after `Creative Questions`.
- The shared answers file still includes `Fun Activities` and `Grammar Practice`.
- This chapter currently lacks the fuller lesson shape established by Chapter 1 and Chapter 5.

### Chapter 8

- The visible chapter ends after `Creative Questions`.
- The shared answers file still includes `Fun Activities` and `Grammar Practice`.
- This chapter also reads as an incomplete lesson compared with the answer structure.

### Chapter 9

- The Lithuanian chapter heading uses `IX Skyrius`, while the surrounding chapters use Arabic numbering; this breaks title consistency in the content.
- The chapter uses `Grammar Exercises: Past Continuous`, while the shared answers file labels the equivalent section `Grammar Practice`.
- Section naming is less consistent than earlier chapters, which weakens navigation clarity.

### Chapter 10

- The chapter uses `Grammar Exercises: Modals of Speculation about the Past`, while the answer key groups the section under `Grammar Practice`.
- This chapter is structurally stronger than Chapters 6 to 8, but section naming still deviates from the dominant lesson pattern.

## Priority fixes suggested by the audit

- Restore or reconcile missing `Fun Activities` and `Grammar Practice` in Chapters 3, 4, 6, 7, and 8.
- Remove or repurpose duplicated trailing `Word Bank` sections in Chapters 2, 3, and 4.
- Normalize chapter sequencing so `Story` consistently comes before practice blocks.
- Normalize section naming so chapter headings and answer-key headings align cleanly.
- Add chapter-level navigation improvements after structural cleanup: collection backlink, sequence label, and progress state.
