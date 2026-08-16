const MIN_SOURCE_COVERAGE_RATIO = 0.6;

export function minimumOrganizedBodyCharacters(source: string): number {
  return Math.floor(source.length * MIN_SOURCE_COVERAGE_RATIO);
}

export function organizedSourceCoverageError(
  source: string,
  organizedBody: string,
): string | null {
  const minimumCharacters = minimumOrganizedBodyCharacters(source);
  if (organizedBody.length < minimumCharacters) {
    return `The organized body retained ${organizedBody.length} of ${source.length} source characters.`;
  }

  const sourceUrls = Array.from(new Set(source.match(/https?:\/\/[^\s<>"']+/g) ?? []));
  const missingUrl = sourceUrls.find((url) => !organizedBody.includes(url));
  if (missingUrl) return "The organized body omitted a source URL.";

  const sourceTimestamps = Array.from(
    new Set(source.match(/\b(?:\d{1,2}:)?\d{1,2}:\d{2}\b/g) ?? []),
  );
  const missingTimestamp = sourceTimestamps.find(
    (timestamp) => !organizedBody.includes(timestamp),
  );
  if (missingTimestamp) return "The organized body omitted a source timestamp.";
  return null;
}
