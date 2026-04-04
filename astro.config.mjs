import { defineConfig } from "astro/config";

const githubRepository = process.env.GITHUB_REPOSITORY;
const [repositoryOwner, repositoryName] = githubRepository
  ? githubRepository.split("/")
  : [];

const site =
  process.env.SITE_URL ??
  (repositoryOwner
    ? `https://${repositoryOwner}.github.io`
    : "https://example.com");

const base =
  process.env.BASE_PATH ??
  (process.env.GITHUB_ACTIONS === "true" && repositoryName
    ? `/${repositoryName}`
    : "/");

export default defineConfig({
  output: "static",
  site,
  base,
  markdown: {
    syntaxHighlight: "shiki",
  },
});
