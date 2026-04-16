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

  it("starts at 1.0.0 for the first classifier release", () => {
    expect(CLASSIFIER_VERSION).toBe("1.0.0");
  });
});
