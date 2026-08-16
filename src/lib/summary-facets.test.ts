import { describe, expect, it } from "vitest";

import {
  groundedModelSummaryFacets,
  normalizedModelSummaryFacets,
  sourceLinksFromText,
} from "./summary-facets";

describe("summary facets", () => {
  it("deduplicates labels and keeps authors out of the people list", () => {
    const facets = normalizedModelSummaryFacets({
      authors: ["Ryan Chapman", "ryan chapman"],
      references: ["Balfour Declaration", "balfour declaration"],
      people: ["Ryan Chapman", "Theodor Herzl"],
      topics: ["Zionism", "zionism"],
      places: ["Palestine"],
      dates: ["1948"],
    });
    expect(facets.authors).toEqual(["Ryan Chapman"]);
    expect(facets.references).toEqual(["Balfour Declaration"]);
    expect(facets.people).toEqual(["Theodor Herzl"]);
    expect(facets.topics).toEqual(["Zionism"]);
  });

  it("extracts safe unique source links with readable labels", () => {
    expect(sourceLinksFromText(
      "https://www.youtube.com/watch?v=one https://www.youtube.com/watch?v=one https://en.wikipedia.org/wiki/Zionism",
    )).toEqual([
      { label: "YouTube", url: "https://www.youtube.com/watch?v=one" },
      { label: "Wikipedia", url: "https://en.wikipedia.org/wiki/Zionism" },
    ]);
  });

  it("drops model labels that are absent from the note evidence", () => {
    const facets = groundedModelSummaryFacets({
      authors: ["Ryan Chapman", "Invented Author"],
      references: ["Balfour Declaration", "Invented Book"],
      people: ["Theodor Herzl"],
      topics: ["Zionism"],
      places: ["Palestine"],
      dates: ["1948"],
    }, "Ryan Chapman discusses Theodor Herzl, Zionism, the Balfour Declaration, Palestine, and 1948.");
    expect(facets.authors).toEqual(["Ryan Chapman"]);
    expect(facets.references).toEqual(["Balfour Declaration"]);
  });
});
