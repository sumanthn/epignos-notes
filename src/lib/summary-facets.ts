import { z } from "zod";

const facetLabel = z.string().trim().min(1).max(100);

const modelSummaryFacetsSchema = z.object({
  authors: z.array(facetLabel).max(6),
  references: z.array(facetLabel).max(8),
  people: z.array(facetLabel).max(10),
  topics: z.array(facetLabel).max(10),
  places: z.array(facetLabel).max(8),
  dates: z.array(facetLabel).max(8),
});

export type ModelSummaryFacets = z.infer<typeof modelSummaryFacetsSchema>;
export type SummaryFacets = ModelSummaryFacets & {
  sources: Array<{ label: string; url: string }>;
};

function uniqueLabels(values: string[]): string[] {
  const seen = new Set<string>();
  return values.filter((value) => {
    const key = value.toLocaleLowerCase();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

export function normalizedModelSummaryFacets(value: unknown): ModelSummaryFacets {
  const parsed = modelSummaryFacetsSchema.parse(value);
  return {
    authors: uniqueLabels(parsed.authors),
    references: uniqueLabels(parsed.references),
    people: uniqueLabels(parsed.people).filter(
      (person) => !parsed.authors.some((author) => author.toLocaleLowerCase() === person.toLocaleLowerCase()),
    ),
    topics: uniqueLabels(parsed.topics),
    places: uniqueLabels(parsed.places),
    dates: uniqueLabels(parsed.dates),
  };
}

export function groundedModelSummaryFacets(
  value: unknown,
  evidenceText: string,
): ModelSummaryFacets {
  const facets = normalizedModelSummaryFacets(value);
  const evidence = evidenceText.normalize("NFKC").toLocaleLowerCase();
  const grounded = (labels: string[]) => labels.filter(
    (label) => evidence.includes(label.normalize("NFKC").toLocaleLowerCase()),
  );
  return {
    authors: grounded(facets.authors),
    references: grounded(facets.references),
    people: grounded(facets.people),
    topics: grounded(facets.topics),
    places: grounded(facets.places),
    dates: grounded(facets.dates),
  };
}

export function sourceLinksFromText(text: string): Array<{ label: string; url: string }> {
  const matches = text.match(/https?:\/\/[^\s<>"'`\])}]+/giu) ?? [];
  const seen = new Set<string>();
  const sources: Array<{ label: string; url: string }> = [];
  for (const raw of matches) {
    const value = raw.replace(/[.,;:!?]+$/u, "");
    if (seen.has(value)) continue;
    try {
      const url = new URL(value);
      if (url.protocol !== "http:" && url.protocol !== "https:") continue;
      seen.add(value);
      const hostname = url.hostname.replace(/^www\./u, "");
      const label = hostname === "youtube.com" || hostname === "youtu.be"
        ? "YouTube"
        : hostname === "wikipedia.org" || hostname.endsWith(".wikipedia.org")
          ? "Wikipedia"
          : hostname;
      sources.push({ label, url: value });
      if (sources.length === 8) break;
    } catch {
      // Ignore malformed URL-like text instead of showing an unsafe link.
    }
  }
  return sources;
}
