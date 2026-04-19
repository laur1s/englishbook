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
    pattern: "{grammar-reference.md,vocabulary-lists.md}",
  }),
  schema: sharedSchema.extend({
    collection: z.literal("resources"),
    contentType: z.literal("reference"),
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
  }),
});

export const collections = {
  greyBook,
  a2Units,
  resources,
  answerKeys,
  speakingMissions,
};
