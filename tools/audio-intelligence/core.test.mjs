import { describe, expect, it } from "vitest";

import {
  normalizedUsage,
  parseYouTubeUrl,
  validatedAnalysis,
  validatedTranscript,
} from "./core.mjs";

const transcript = validatedTranscript({
  text: "First point. Second point.",
  language: "English",
  duration: 10,
  segments: [
    { id: 0, start: 0, end: 4.5, text: "First point." },
    { id: 1, start: 4.5, end: 9.8, text: "Second point." },
  ],
  usage: { seconds: 10, cost: 0.001 },
});

function analysis(overrides = {}) {
  return {
    title: "Two points",
    one_sentence_summary: "The speaker makes two points.",
    detailed_summary: "The first point is followed by a second point.",
    chapters: [
      {
        start_seconds: 0,
        end_seconds: 9.8,
        title: "Both points",
        summary: "The complete source.",
        evidence_segment_ids: [0, 1],
      },
    ],
    key_takeaways: [{ text: "There are two points.", evidence_segment_ids: [0, 1] }],
    concepts: [{ name: "Point", explanation: "A stated idea.", evidence_segment_ids: [0] }],
    claims: [
      {
        statement: "The first point was stated.",
        attribution: "Speaker",
        confidence: "high",
        evidence_segment_ids: [0],
      },
    ],
    entities: [],
    audio_only_limitations: ["No visuals were processed."],
    ...overrides,
  };
}

describe("parseYouTubeUrl", () => {
  it.each([
    "https://www.youtube.com/shorts/z9OicXWc20U",
    "https://youtube.com/watch?v=z9OicXWc20U&list=ignored",
    "https://youtu.be/z9OicXWc20U?t=3",
  ])("canonicalizes a supported single-video URL", (url) => {
    expect(parseYouTubeUrl(url)).toEqual({
      videoId: "z9OicXWc20U",
      canonicalUrl: "https://www.youtube.com/watch?v=z9OicXWc20U",
    });
  });

  it.each([
    "http://youtube.com/watch?v=z9OicXWc20U",
    "https://example.com/watch?v=z9OicXWc20U",
    "https://youtube.com/playlist?list=z9OicXWc20U",
    "not a url",
  ])("rejects an unsafe or unsupported URL", (url) => {
    expect(() => parseYouTubeUrl(url)).toThrow();
  });
});

describe("validatedTranscript", () => {
  it("rejects duplicate segment IDs", () => {
    expect(() =>
      validatedTranscript({
        ...transcript,
        segments: [transcript.segments[0], { ...transcript.segments[1], id: 0 }],
      }),
    ).toThrow("unique");
  });

  it("rejects segments beyond the recording", () => {
    expect(() =>
      validatedTranscript({
        ...transcript,
        segments: [{ id: 0, start: 9, end: 12, text: "Too late." }],
      }),
    ).toThrow("duration");
  });
});

describe("validatedAnalysis", () => {
  it("accepts grounded evidence and removes duplicate citations", () => {
    const result = validatedAnalysis(
      analysis({
        key_takeaways: [{ text: "There are two points.", evidence_segment_ids: [0, 0, 1] }],
      }),
      transcript,
    );
    expect(result.key_takeaways[0].evidence_segment_ids).toEqual([0, 1]);
  });

  it("rejects a fabricated segment citation", () => {
    expect(() =>
      validatedAnalysis(
        analysis({
          claims: [
            {
              statement: "Unsupported claim.",
              attribution: "Speaker",
              confidence: "low",
              evidence_segment_ids: [99],
            },
          ],
        }),
        transcript,
      ),
    ).toThrow("does not exist");
  });

  it("rejects chapters beyond the recording", () => {
    expect(() =>
      validatedAnalysis(
        analysis({
          chapters: [
            {
              start_seconds: 0,
              end_seconds: 12,
              title: "Too long",
              summary: "Outside the source.",
              evidence_segment_ids: [0],
            },
          ],
        }),
        transcript,
      ),
    ).toThrow("audio duration");
  });
});

describe("normalizedUsage", () => {
  it("records the exact component and total costs", () => {
    expect(
      normalizedUsage(
        { seconds: 70.364, cost: 0.00216956614656 },
        { prompt_tokens: 1084, completion_tokens: 1531, total_tokens: 2615, cost: 0.001054025 },
      ),
    ).toEqual({
      transcription: { seconds: 70.364, costUsd: 0.00216956614656 },
      analysis: {
        promptTokens: 1084,
        completionTokens: 1531,
        totalTokens: 2615,
        costUsd: 0.001054025,
      },
      totalCostUsd: 0.00322359114656,
    });
  });
});
