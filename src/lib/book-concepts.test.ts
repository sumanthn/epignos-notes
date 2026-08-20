import { describe, expect, it } from "vitest";

import { validatedBookConceptMap } from "./book-concepts-schema";

const sources = new Set(["note-a", "note-b", "note-c"]);

function conceptMap() {
  return {
    overview: "The notes connect nationalism, sovereignty, and political identity.",
    concepts: [
      {
        key: "nationalism",
        name: "Nationalism",
        kind: "idea",
        description: "A political identity organized around a nation.",
        sourceNoteIds: ["note-a", "note-b"],
      },
      {
        key: "sovereignty",
        name: "Sovereignty",
        kind: "idea",
        description: "Authority claimed by a political community.",
        sourceNoteIds: ["note-b", "note-c"],
      },
    ],
    relations: [
      {
        fromKey: "nationalism",
        toKey: "sovereignty",
        kind: "related_to",
        description: "The notes connect national identity with claims to political authority.",
        sourceNoteIds: ["note-b"],
      },
    ],
  };
}

describe("book concept maps", () => {
  it("accepts concepts and relationships grounded in shared book notes", () => {
    const value = validatedBookConceptMap(conceptMap(), sources);
    expect(value.concepts).toHaveLength(2);
    expect(value.relations).toHaveLength(1);
  });

  it("rejects a concept source outside the book", () => {
    const value = conceptMap();
    value.concepts[0].sourceNoteIds = ["unknown-note"];
    expect(() => validatedBookConceptMap(value, sources)).toThrow("outside this book");
  });

  it("rejects duplicate concept names regardless of case", () => {
    const value = conceptMap();
    value.concepts[1].name = "NATIONALISM";
    expect(() => validatedBookConceptMap(value, sources)).toThrow("duplicate concept names");
  });

  it("rejects relationships whose evidence does not support both concepts", () => {
    const value = conceptMap();
    value.relations[0].sourceNoteIds = ["note-a"];
    expect(() => validatedBookConceptMap(value, sources)).toThrow("shared concept evidence");
  });

  it("rejects unknown and self-referential relationship endpoints", () => {
    const unknown = conceptMap();
    unknown.relations[0].toKey = "missing";
    expect(() => validatedBookConceptMap(unknown, sources)).toThrow("unknown concept");

    const self = conceptMap();
    self.relations[0].toKey = "nationalism";
    expect(() => validatedBookConceptMap(self, sources)).toThrow("relate to itself");
  });
});

