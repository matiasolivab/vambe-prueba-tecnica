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

  it("is on the 3.x major line (schema shape changed — buyingSignal replaced by leadSource)", () => {
    expect(CLASSIFIER_VERSION).toMatch(/^3\.\d+\.\d+$/);
  });
});
