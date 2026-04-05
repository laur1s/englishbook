# Grey's Book Mobile Audit

## Surfaces reviewed

- Short chapter pattern: Chapter 1
- Medium chapter pattern: Chapter 6
- Long chapter pattern: Chapter 4 and Chapter 5
- Reader shell, table of contents fallback, prose tables, translation popover, and previous/next navigation

## Findings

### 1. Table of contents falls below the chapter content on mobile

- In the current responsive layout, the reader sidebar moves after the main content on screens below the `960px` breakpoint.
- That means the mobile user loses the page outline until they have already scrolled through the chapter.
- Affected files:
  - `src/styles/global.css`
  - `src/layouts/ReaderLayout.astro`

### 2. Prose tables are not wrapped for horizontal overflow

- Chapter activities such as the tables in Chapter 4 and Chapter 5 can exceed narrow viewport width.
- The current table styling uses `width: 100%` and cell borders, but there is no overflow wrapper or small-screen fallback.
- On mobile, this risks clipped columns or forced text compression.
- Affected files:
  - `src/styles/global.css`
  - chapter Markdown files that contain activity tables

### 3. Long-press translation popover can cover the reading target

- The translation popover is fixed-positioned and always prefers placement below the pressed point.
- On smaller screens, that can obscure the paragraph the learner is trying to read, especially near the bottom half of the viewport.
- There is no touch-specific close affordance beyond tapping elsewhere.
- Affected files:
  - `src/layouts/BaseLayout.astro`
  - `src/styles/global.css`

### 4. Previous/next navigation is functional but weak on mobile

- The pager collapses to a single-column stack correctly, but it appears only at the end of the chapter.
- There is still no quick return link to the Grey's Book collection or a visible chapter-sequence label near the top of the page.
- On mobile, that makes chapter movement feel heavier than it should.
- Affected files:
  - `src/layouts/ReaderLayout.astro`
  - `src/lib/content.ts`

### 5. Long summary rows are vulnerable to awkward wrapping

- Collapsible summaries are laid out with `display: flex` and `justify-content: space-between`.
- Long English titles plus Lithuanian helper subtitles can wrap unevenly on smaller screens.
- This is most visible on answer preview rows and chapters with verbose activity names.
- Affected files:
  - `src/styles/global.css`
  - `src/layouts/ReaderLayout.astro`

## Priority fixes suggested by the audit

- Keep the chapter outline accessible near the top of mobile pages instead of moving it below the full chapter body.
- Make prose tables horizontally scrollable or convert them to a mobile-friendly stacked layout.
- Reposition the translation popover above the press point when there is not enough room below.
- Add stronger chapter-level navigation near the top of the reader, not just at the end.
- Relax summary layout on narrow screens so long bilingual labels wrap cleanly.
