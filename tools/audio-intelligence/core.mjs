import { z } from "zod";

const YOUTUBE_VIDEO_ID = /^[A-Za-z0-9_-]{11}$/;
const ALLOWED_YOUTUBE_HOSTS = new Set([
  "youtube.com",
  "www.youtube.com",
  "m.youtube.com",
  "music.youtube.com",
  "youtu.be",
]);

const usageSchema = z
  .object({
    seconds: z.number().nonnegative().optional(),
    prompt_tokens: z.number().int().nonnegative().optional(),
    completion_tokens: z.number().int().nonnegative().optional(),
    total_tokens: z.number().int().nonnegative().optional(),
    cost: z.number().nonnegative().optional(),
  })
  .passthrough();

const transcriptSegmentSchema = z
  .object({
    id: z.number().int().nonnegative(),
    start: z.number().nonnegative(),
    end: z.number().positive(),
    text: z.string().trim().min(1),
  })
  .passthrough();

const transcriptSchema = z
  .object({
    text: z.string().trim().min(1),
    language: z.string().trim().min(1),
    duration: z.number().positive(),
    segments: z.array(transcriptSegmentSchema).min(1),
    usage: usageSchema.optional(),
  })
  .passthrough();

const evidenceIdsSchema = z.array(z.number().int().nonnegative()).min(1);
const sourcedTextSchema = z
  .object({
    text: z.string().trim().min(1).max(800),
    evidence_segment_ids: evidenceIdsSchema,
  })
  .strict();

const analysisSchema = z
  .object({
    title: z.string().trim().min(1).max(200),
    one_sentence_summary: z.string().trim().min(1).max(800),
    detailed_summary: z.string().trim().min(1).max(5_000),
    chapters: z
      .array(
        z
          .object({
            start_seconds: z.number().nonnegative(),
            end_seconds: z.number().positive(),
            title: z.string().trim().min(1).max(160),
            summary: z.string().trim().min(1).max(1_200),
            evidence_segment_ids: evidenceIdsSchema,
          })
          .strict(),
      )
      .min(1)
      .max(20),
    key_takeaways: z.array(sourcedTextSchema).min(1).max(12),
    concepts: z
      .array(
        z
          .object({
            name: z.string().trim().min(1).max(160),
            explanation: z.string().trim().min(1).max(1_200),
            evidence_segment_ids: evidenceIdsSchema,
          })
          .strict(),
      )
      .max(20),
    claims: z
      .array(
        z
          .object({
            statement: z.string().trim().min(1).max(1_200),
            attribution: z.string().trim().min(1).max(240),
            confidence: z.enum(["high", "medium", "low"]),
            evidence_segment_ids: evidenceIdsSchema,
          })
          .strict(),
      )
      .max(30),
    entities: z
      .array(
        z
          .object({
            name: z.string().trim().min(1).max(200),
            type: z.enum(["person", "organization", "place", "technology", "other"]),
            context: z.string().trim().min(1).max(800),
            evidence_segment_ids: evidenceIdsSchema,
          })
          .strict(),
      )
      .max(30),
    audio_only_limitations: z.array(z.string().trim().min(1).max(800)).min(1).max(10),
  })
  .strict();

export const analysisJsonSchema = {
  type: "object",
  additionalProperties: false,
  required: [
    "title",
    "one_sentence_summary",
    "detailed_summary",
    "chapters",
    "key_takeaways",
    "concepts",
    "claims",
    "entities",
    "audio_only_limitations",
  ],
  properties: {
    title: { type: "string" },
    one_sentence_summary: { type: "string" },
    detailed_summary: { type: "string" },
    chapters: {
      type: "array",
      minItems: 1,
      maxItems: 20,
      items: {
        type: "object",
        additionalProperties: false,
        required: [
          "start_seconds",
          "end_seconds",
          "title",
          "summary",
          "evidence_segment_ids",
        ],
        properties: {
          start_seconds: { type: "number" },
          end_seconds: { type: "number" },
          title: { type: "string" },
          summary: { type: "string" },
          evidence_segment_ids: {
            type: "array",
            minItems: 1,
            items: { type: "integer" },
          },
        },
      },
    },
    key_takeaways: {
      type: "array",
      minItems: 1,
      maxItems: 12,
      items: {
        type: "object",
        additionalProperties: false,
        required: ["text", "evidence_segment_ids"],
        properties: {
          text: { type: "string" },
          evidence_segment_ids: {
            type: "array",
            minItems: 1,
            items: { type: "integer" },
          },
        },
      },
    },
    concepts: {
      type: "array",
      maxItems: 20,
      items: {
        type: "object",
        additionalProperties: false,
        required: ["name", "explanation", "evidence_segment_ids"],
        properties: {
          name: { type: "string" },
          explanation: { type: "string" },
          evidence_segment_ids: {
            type: "array",
            minItems: 1,
            items: { type: "integer" },
          },
        },
      },
    },
    claims: {
      type: "array",
      maxItems: 30,
      items: {
        type: "object",
        additionalProperties: false,
        required: ["statement", "attribution", "confidence", "evidence_segment_ids"],
        properties: {
          statement: { type: "string" },
          attribution: { type: "string" },
          confidence: { type: "string", enum: ["high", "medium", "low"] },
          evidence_segment_ids: {
            type: "array",
            minItems: 1,
            items: { type: "integer" },
          },
        },
      },
    },
    entities: {
      type: "array",
      maxItems: 30,
      items: {
        type: "object",
        additionalProperties: false,
        required: ["name", "type", "context", "evidence_segment_ids"],
        properties: {
          name: { type: "string" },
          type: {
            type: "string",
            enum: ["person", "organization", "place", "technology", "other"],
          },
          context: { type: "string" },
          evidence_segment_ids: {
            type: "array",
            minItems: 1,
            items: { type: "integer" },
          },
        },
      },
    },
    audio_only_limitations: {
      type: "array",
      minItems: 1,
      maxItems: 10,
      items: { type: "string" },
    },
  },
};

export function parseYouTubeUrl(input) {
  let url;
  try {
    url = new URL(input);
  } catch {
    throw new Error("Provide a valid YouTube URL.");
  }

  if (url.protocol !== "https:" || !ALLOWED_YOUTUBE_HOSTS.has(url.hostname.toLowerCase())) {
    throw new Error("Only HTTPS YouTube URLs are supported.");
  }

  let videoId = null;
  const pathParts = url.pathname.split("/").filter(Boolean);
  if (url.hostname.toLowerCase() === "youtu.be") {
    videoId = pathParts[0] ?? null;
  } else if (url.pathname === "/watch") {
    videoId = url.searchParams.get("v");
  } else if (["shorts", "embed", "live"].includes(pathParts[0])) {
    videoId = pathParts[1] ?? null;
  }

  if (!videoId || !YOUTUBE_VIDEO_ID.test(videoId)) {
    throw new Error("The YouTube URL does not contain a valid video ID.");
  }

  return {
    videoId,
    canonicalUrl: `https://www.youtube.com/watch?v=${videoId}`,
  };
}

export function validatedTranscript(value) {
  const transcript = transcriptSchema.parse(value);
  const ids = new Set();
  let previousStart = -1;

  for (const segment of transcript.segments) {
    if (ids.has(segment.id)) throw new Error("Transcript segment IDs must be unique.");
    if (segment.end <= segment.start) throw new Error("Transcript segment time range is invalid.");
    if (segment.start < previousStart) throw new Error("Transcript segments are out of order.");
    if (segment.end > transcript.duration + 1) {
      throw new Error("A transcript segment ends after the audio duration.");
    }
    ids.add(segment.id);
    previousStart = segment.start;
  }

  return transcript;
}

function evidenceCollections(analysis) {
  return [
    ...analysis.chapters,
    ...analysis.key_takeaways,
    ...analysis.concepts,
    ...analysis.claims,
    ...analysis.entities,
  ];
}

export function validatedAnalysis(value, transcript) {
  const analysis = analysisSchema.parse(value);
  const validIds = new Set(transcript.segments.map((segment) => segment.id));

  for (const item of evidenceCollections(analysis)) {
    item.evidence_segment_ids = [...new Set(item.evidence_segment_ids)];
    if (item.evidence_segment_ids.some((id) => !validIds.has(id))) {
      throw new Error("AI analysis cited a transcript segment that does not exist.");
    }
  }

  let previousStart = -1;
  for (const chapter of analysis.chapters) {
    if (chapter.end_seconds <= chapter.start_seconds) {
      throw new Error("AI analysis returned an invalid chapter time range.");
    }
    if (chapter.start_seconds < previousStart) {
      throw new Error("AI analysis returned chapters out of order.");
    }
    if (chapter.end_seconds > transcript.duration + 1) {
      throw new Error("AI analysis returned a chapter beyond the audio duration.");
    }
    previousStart = chapter.start_seconds;
  }

  return analysis;
}

export function normalizedUsage(transcriptUsage, analysisUsage) {
  const transcription = usageSchema.parse(transcriptUsage ?? {});
  const transcriptionCost = transcription.cost ?? 0;
  const analysis = usageSchema.parse(analysisUsage ?? {});
  const analysisCost = analysis.cost ?? 0;
  const totalCost = Number((transcriptionCost + analysisCost).toFixed(15));
  return {
    transcription: {
      seconds: transcription.seconds ?? null,
      costUsd: transcriptionCost,
    },
    analysis: {
      promptTokens: analysis.prompt_tokens ?? null,
      completionTokens: analysis.completion_tokens ?? null,
      totalTokens: analysis.total_tokens ?? null,
      costUsd: analysisCost,
    },
    totalCostUsd: totalCost,
  };
}

export function compactTranscript(transcript) {
  return {
    language: transcript.language,
    duration: transcript.duration,
    segments: transcript.segments.map(({ id, start, end, text }) => ({
      id,
      start,
      end,
      text,
    })),
  };
}
