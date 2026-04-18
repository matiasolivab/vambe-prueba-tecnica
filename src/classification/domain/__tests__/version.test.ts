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

  it("is on the 2.x major line (schema shape changed — output contract breaks with 1.x)", () => {
    // Major bump 1.x → 2.0.0 because the output schema removes two categorical
    // dimensions (purchaseTimeline, decisionMakerRole). Persisted rows from 1.x
    // are distinguishable in the DB by this version string.
    expect(CLASSIFIER_VERSION).toMatch(/^2\.\d+\.\d+$/);
  });
});
