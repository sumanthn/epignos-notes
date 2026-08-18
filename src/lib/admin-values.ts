export type DatabaseFootprint = {
  collections: number | null;
  objects: number | null;
  dataSizeBytes: number | null;
  storageSizeBytes: number | null;
  indexSizeBytes: number | null;
  totalSizeBytes: number | null;
};

function finiteNumber(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

export function normalizedDatabaseFootprint(value: unknown): DatabaseFootprint | null {
  if (!value || typeof value !== "object") return null;
  const stats = value as Record<string, unknown>;
  return {
    collections: finiteNumber(stats.collections),
    objects: finiteNumber(stats.objects),
    dataSizeBytes: finiteNumber(stats.dataSize),
    storageSizeBytes: finiteNumber(stats.storageSize),
    indexSizeBytes: finiteNumber(stats.indexSize),
    totalSizeBytes: finiteNumber(stats.totalSize),
  };
}
