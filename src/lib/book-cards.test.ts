import { describe, expect, it } from "vitest";

import { validatedBookCardDeck } from "./book-cards-schema";

const sources = new Set(["note-a", "note-b"]);

function deck() {
  return {
    overview: "A compact overview grounded in the notes.",
    cards: [
      {
        title: "Core idea",
        kind: "concept",
        summary: "The central concept in one sentence.",
        points: [{ text: "A concise recall point.", sourceNoteIds: ["note-a"] }],
      },
      {
        title: "Key comparison",
        kind: "comparison",
        summary: "The most useful contrast.",
        points: [{ text: "A second recall point.", sourceNoteIds: ["note-a", "note-b"] }],
      },
    ],
  };
}

describe("book summary cards", () => {
  it("accepts a concise deck whose points cite notes from the book", () => {
    expect(validatedBookCardDeck(deck(), sources).cards).toHaveLength(2);
  });

  it("rejects a point that cites a note outside the book", () => {
    const value = deck();
    value.cards[0].points[0].sourceNoteIds = ["unknown-note"];
    expect(() => validatedBookCardDeck(value, sources)).toThrow("outside this book");
  });

  it("rejects duplicate card titles", () => {
    const value = deck();
    value.cards[1].title = "CORE IDEA";
    expect(() => validatedBookCardDeck(value, sources)).toThrow("duplicate card titles");
  });

  it("rejects cards with more than four recall points", () => {
    const value = deck();
    value.cards[0].points = Array.from({ length: 5 }, (_, index) => ({
      text: `Point ${index + 1}`,
      sourceNoteIds: ["note-a"],
    }));
    expect(() => validatedBookCardDeck(value, sources)).toThrow();
  });
});
