# Site Maintenance

This frontend publishes the repository's Markdown files directly through Astro. The repository Markdown remains the source of truth.

## Content schema

Every published Markdown file needs frontmatter with these fields:

- `title`
- `ltTitle`
- `slug`
- `collection`
- `order`
- `contentType`
- `level`
- `grammarFocus`
- `topics`
- `hasAnswerKey`
- `status`

## Collections

- `grey-book`: `Grey's book/chapter-*.md`
- `a2-units`: `unit-*.md`
- `resources`: `grammar-reference.md`, `vocabulary-lists.md`, and published `a2-*.md` resource packs
- `answer-keys`: `answer-key.md`, `Grey's book/answers.md`
- `speaking-missions`: `speaking/*.md`

## Adding new content

1. Copy an existing file from the same collection and keep the frontmatter shape.
2. Set a unique `slug` and the correct `order`.
3. Keep the Markdown source in the existing repo location instead of creating a second content copy.
4. For Grey's Book chapters, keep section order consistent: `Phrasal Verbs`, `Word Bank`, `Story`, then question/activity sections.
5. Run `pnpm qa` before pushing. It checks Astro types, helper regressions, content integrity, the generated practice catalog, the production build, and generated internal routes/fragments.
6. For a material learner-facing change, smoke-test the dashboard, one content session, choice and fill-blank scoring, saved resume, a cumulative checkpoint, home, one lesson, and one speaking mission on desktop and mobile.

## GitHub Pages

The deployment workflow builds and publishes the `dist` directory on every push to `main`. `astro.config.mjs` derives the project-site base path from `GITHUB_REPOSITORY`, so the site works on standard GitHub Pages project URLs without hardcoding the repository name.
