import { defineCollection } from "astro:content";
import { glob } from "astro/loaders";
import { z } from "astro/zod";

const sharedSchema = z.object({
  title: z.string(),
  ltTitle: z.string(),
  slug: z.string(),
  collection: z.enum([
    "grey-book",
    "a2-units",
    "resources",
    "answer-keys",
    "speaking-missions",
  ]),
  order: z.number().int().positive(),
  contentType: z.enum(["chapter", "unit", "reference", "answer-key", "speaking-mission"]),
  level: z.string(),
  grammarFocus: z.array(z.string()).min(1),
  topics: z.array(z.string()).min(1),
  hasAnswerKey: z.boolean(),
  status: z.enum(["draft", "published"]),
});

const speakingStepSchema = z.object({
  kind: z.enum(["brief", "prep", "speak", "compare", "reflect"]),
  prompt: z.string(),
  ltPrompt: z.string().optional(),
  seconds: z.number().int().positive().optional(),
  support: z.array(z.string()).optional(),
});

const listeningOptionSchema = z.object({
  id: z.string().regex(/^[a-z0-9]+(?:[.-][a-z0-9]+)*$/),
  text: z.string(),
});

const listeningCheckSchema = z
  .object({
    id: z.string().regex(/^[a-z0-9]+(?:[.-][a-z0-9]+)*$/),
    kind: z.enum(["gist", "detail"]),
    prompt: z.string(),
    ltPrompt: z.string(),
    hint: z.string(),
    ltHint: z.string(),
    options: z.array(listeningOptionSchema).length(3),
    answerId: z.string(),
    feedback: z.string(),
    ltFeedback: z.string(),
  })
  .superRefine((check, context) => {
    const optionIds = check.options.map((option) => option.id);

    if (new Set(optionIds).size !== optionIds.length) {
      context.addIssue({
        code: "custom",
        message: "Listening option IDs must be unique within a check.",
        path: ["options"],
      });
    }

    if (!optionIds.includes(check.answerId)) {
      context.addIssue({
        code: "custom",
        message: "Listening answerId must match one of the option IDs.",
        path: ["answerId"],
      });
    }
  });

const listeningSchema = z
  .object({
    modelText: z.string(),
    speechText: z.string(),
    checks: z.array(listeningCheckSchema).length(2),
    shadowLine: z.string(),
    shadowLineLt: z.string(),
  })
  .superRefine((listening, context) => {
    const checkIds = listening.checks.map((check) => check.id);
    if (new Set(checkIds).size !== checkIds.length) {
      context.addIssue({
        code: "custom",
        message: "Listening check IDs must be unique within a mission.",
        path: ["checks"],
      });
    }

    const kinds = listening.checks.map((check) => check.kind);
    if (!kinds.includes("gist") || !kinds.includes("detail")) {
      context.addIssue({
        code: "custom",
        message: "Listening checks must include one gist check and one detail check.",
        path: ["checks"],
      });
    }
  });

const greyBook = defineCollection({
  loader: glob({ base: "./Grey's book", pattern: "chapter-*.md" }),
  schema: sharedSchema.extend({
    collection: z.literal("grey-book"),
    contentType: z.literal("chapter"),
  }),
});

const a2Units = defineCollection({
  loader: glob({ base: ".", pattern: "unit-*.md" }),
  schema: sharedSchema.extend({
    collection: z.literal("a2-units"),
    contentType: z.literal("unit"),
  }),
});

const resources = defineCollection({
  loader: glob({
    base: ".",
    pattern: "{grammar-reference.md,vocabulary-lists.md,a2-*.md}",
  }),
  schema: sharedSchema.extend({
    collection: z.literal("resources"),
    contentType: z.literal("reference"),
    resourceGroup: z.enum([
      "start-plan",
      "understand-repair",
      "real-life",
      "active-practice",
    ]),
  }),
});

const answerKeys = defineCollection({
  loader: glob({
    base: ".",
    pattern: "{answer-key.md,Grey's book/answers.md}",
  }),
  schema: sharedSchema.extend({
    collection: z.literal("answer-keys"),
    contentType: z.literal("answer-key"),
  }),
});

const speakingMissions = defineCollection({
  loader: glob({ base: "./speaking", pattern: "*.md" }),
  schema: sharedSchema.extend({
    collection: z.literal("speaking-missions"),
    contentType: z.literal("speaking-mission"),
    missionType: z.enum([
      "one-minute-mission",
      "role-flip-dialogue",
      "mistake-detective",
      "shadow-scene",
      "conversation-roulette",
    ]),
    durationMinutes: z.number().int().positive().max(10),
    sourceRefs: z.array(z.string()).min(1),
    supportsRecording: z.boolean(),
    steps: z.array(speakingStepSchema).length(5),
    listening: listeningSchema.optional(),
  }),
});

export const collections = {
  greyBook,
  a2Units,
  resources,
  answerKeys,
  speakingMissions,
};
