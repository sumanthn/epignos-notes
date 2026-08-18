import { describe, expect, it } from "vitest";

import { normalizedDatabaseFootprint } from "./admin-values";
import { isSuperAdminUser } from "./system-role";

describe("super-admin authorization", () => {
  it("grants access only to the exact platform role", () => {
    expect(isSuperAdminUser({ systemRole: "superadmin" })).toBe(true);
    expect(isSuperAdminUser({ systemRole: null })).toBe(false);
  });
});

describe("database footprint normalization", () => {
  it("keeps only finite numeric database statistics", () => {
    expect(
      normalizedDatabaseFootprint({
        collections: 12,
        objects: 140,
        dataSize: 2_000,
        storageSize: 4_000,
        indexSize: 900,
        totalSize: 4_900,
        ignored: "server detail",
      }),
    ).toEqual({
      collections: 12,
      objects: 140,
      dataSizeBytes: 2_000,
      storageSizeBytes: 4_000,
      indexSizeBytes: 900,
      totalSizeBytes: 4_900,
    });
  });

  it("returns null for an unavailable database response", () => {
    expect(normalizedDatabaseFootprint(null)).toBeNull();
  });
});
