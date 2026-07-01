import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const read = (relativePath) =>
  readFileSync(new URL(`../${relativePath}`, import.meta.url), "utf8");

const missionFiles = [
  "introduce-yourself-fast",
  "my-ordinary-day",
  "weekend-story",
  "restaurant-rescue",
  "lost-but-clear",
  "weekend-plan-sprint",
  "life-experience-sprint",
  "comparison-clinic",
  "advice-or-maybe",
  "habit-now-experience",
  "when-it-happened",
  "a2-real-life-challenge",
  "lost-property-desk",
  "whose-is-it",
  "house-rules-meeting",
  "pharmacy-conversation",
  "weather-backup-plan",
  "course-help-desk",
  "tech-support-call",
  "invitation-switch",
  "eco-choice-challenge",
  "calm-complaint",
  "recommendation-chain",
  "host-a-weekend",
];

const missions = missionFiles.map((slug, index) => ({
  slug,
  source: read(`speaking/mission-${String(index + 1).padStart(2, "0")}-${slug}.md`),
}));

test("every speaking mission follows the same evidence-based rehearsal loop", () => {
  for (const { slug, source } of missions) {
    const frontmatterMatch = source.match(/^---\n([\s\S]*?)\n---/);
    const frontmatter = frontmatterMatch?.[1] ?? "";
    const body = source.slice(frontmatterMatch?.[0].length ?? 0);
    const stepKinds = [...frontmatter.matchAll(/^\s{2}- kind: "([^"]+)"$/gm)].map(
      (match) => match[1],
    );

    assert.deepEqual(
      stepKinds,
      ["brief", "prep", "speak", "compare", "reflect"],
      `${slug} has a broken mission sequence`,
    );
    assert.match(frontmatter, /^supportsRecording: true$/m, `${slug} cannot record`);
    assert.match(body, /^## .*Success Check/m, `${slug} has no visible success criteria`);
    assert.match(body, /second attempt|second run/i, `${slug} has no changed second attempt`);
    assert.doesNotMatch(source, /How confident did this feel\?/i);
  }
});

test("substantially rebuilt speaking tasks invalidate only their old completions", () => {
  const manifest = JSON.parse(read("learning/course-path.json"));
  const sessions = manifest.modules.flatMap((module) => module.sessions);

  const rebuiltRevisions = new Map([
    ["module-01-speak", 2],
    ["module-04-speak", 2],
    ["module-08-speak", 2],
    ["module-09-speak", 2],
    ["module-19-speak", 3],
    ["module-24-speak", 2],
  ]);

  for (const [sessionId, revision] of rebuiltRevisions) {
    const session = sessions.find((candidate) => candidate.id === sessionId);
    assert.equal(session?.revision, revision, `${sessionId} needs revision ${revision}`);
  }
});

test("listening pilots provide one valid gist check and one valid detail check", () => {
  const pilotSlugs = new Set([
    "introduce-yourself-fast",
    "restaurant-rescue",
    "tech-support-call",
  ]);
  const stableId = /^[a-z0-9]+(?:[.-][a-z0-9]+)*$/;

  for (const { slug, source } of missions.filter((mission) => pilotSlugs.has(mission.slug))) {
    const frontmatter = source.match(/^---\n([\s\S]*?)\n---/)?.[1] ?? "";
    const listening = frontmatter.match(/^listening:\n([\s\S]*?)^steps:/m)?.[1] ?? "";

    assert.notEqual(listening, "", `${slug} has no listening pilot`);
    assert.match(listening, /^  modelText: >-\n    \S.+$/m, `${slug} has no model text`);
    assert.match(listening, /^  speechText: >-\n    \S.+$/m, `${slug} has no speech-friendly text`);
    assert.match(listening, /^  shadowLine: "\S.+"$/m, `${slug} has no shadow line`);
    assert.match(listening, /^  shadowLineLt: "\S.+"$/m, `${slug} has no Lithuanian shadow line`);

    const checkBlocks = [
      ...listening.matchAll(
        /^    - id: "([^"]+)"\n([\s\S]*?)(?=^    - id: "|^  shadowLine:)/gm,
      ),
    ];
    assert.equal(checkBlocks.length, 2, `${slug} needs exactly two listening checks`);

    const kinds = [];
    for (const [, checkId, checkBody] of checkBlocks) {
      assert.match(checkId, stableId, `${slug} has an unstable check ID`);

      const kind = checkBody.match(/^      kind: "(gist|detail)"$/m)?.[1];
      kinds.push(kind);
      assert.match(checkBody, /^      prompt: "\S.+"$/m, `${checkId} has no English prompt`);
      assert.match(checkBody, /^      ltPrompt: "\S.+"$/m, `${checkId} has no Lithuanian prompt`);
      assert.match(checkBody, /^      hint: "\S.+"$/m, `${checkId} has no repair hint`);
      assert.match(checkBody, /^      ltHint: "\S.+"$/m, `${checkId} has no Lithuanian repair hint`);
      assert.match(checkBody, /^      feedback: "\S.+"$/m, `${checkId} has no English feedback`);
      assert.match(checkBody, /^      ltFeedback: "\S.+"$/m, `${checkId} has no Lithuanian feedback`);

      const options = [
        ...checkBody.matchAll(/^        - id: "([^"]+)"\n          text: "([^"]+)"$/gm),
      ];
      assert.equal(options.length, 3, `${checkId} needs exactly three options`);
      const optionIds = options.map((option) => option[1]);
      assert.equal(new Set(optionIds).size, 3, `${checkId} has duplicate option IDs`);
      for (const optionId of optionIds) {
        assert.match(optionId, stableId, `${checkId} has an unstable option ID`);
      }

      const answerId = checkBody.match(/^      answerId: "([^"]+)"$/m)?.[1];
      assert.ok(optionIds.includes(answerId), `${checkId} answerId does not match an option`);
    }

    assert.deepEqual(kinds.sort(), ["detail", "gist"], `${slug} needs gist and detail checks`);
  }
});

test("the Unit 1 listening model stays inside the Unit 1 grammar progression", () => {
  const source = missions.find((mission) => mission.slug === "introduce-yourself-fast")?.source ?? "";
  const listening = source.match(/^listening:\n([\s\S]*?)^steps:/m)?.[1] ?? "";

  assert.doesNotMatch(listening, /I moved here|outside work/i);
  assert.match(listening, /What do you do in your free time\?/);
});
