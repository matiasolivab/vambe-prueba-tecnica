import { describe, it, expect } from "vitest";

import { CLASSIFIER_VERSION } from "../version";

describe("CLASSIFIER_VERSION", () => {
  it("is a non-empty string", () => {
    expect(typeof CLASSIFIER_VERSION).toBe("string");
    expect(CLASSIFIER_VERSION.length).toBeGreaterThan(0);
  });

  it("matches simple semver (MAJOR.MINOR.PATCH)", () => {
    expect(CLASSIFIER_VERSION).toMatch(/^\d+\.\d+\.\d+$/);
  });

  it("stays on the 1.x major line (minor bumps allowed per ARCHITECTURE §13 rule 13)", () => {
    // The major version is the stable contract for persisted rows in the DB —
    // only a breaking classifier change should bump it. Minor bumps track
    // prompt iterations (1.0.0 → 1.1.0 → 1.2.0 …) and are expected.
    expect(CLASSIFIER_VERSION).toMatch(/^1\.\d+\.\d+$/);
  });
});
