import { describe, expect, it } from "vitest";

import {
  metricFiltersOf,
  parseFiltersFromSearchParams,
} from "@/shared/filters/parse-filters";

describe("parseFiltersFromSearchParams", () => {
  it("returns an empty object when no query params are present", () => {
    expect(parseFiltersFromSearchParams(new URLSearchParams())).toEqual({});
    expect(parseFiltersFromSearchParams({})).toEqual({});
  });

  it("maps vendor=Toro to assignedSeller", () => {
    const sp = new URLSearchParams({ vendor: "Toro" });
    expect(parseFiltersFromSearchParams(sp)).toEqual({ assignedSeller: "Toro" });
  });

  it("maps industry + size + sentiment by URL key", () => {
    const sp = new URLSearchParams({
      industry: "Tecnología",
      size: "PYME",
      sentiment: "Positivo",
    });
    expect(parseFiltersFromSearchParams(sp)).toEqual({
      industry: "Tecnología",
      companySize: "PYME",
      sentiment: "Positivo",
    });
  });

  it("coerces closed=true and closed=false to booleans; ignores other values", () => {
    expect(
      parseFiltersFromSearchParams(new URLSearchParams({ closed: "true" })),
    ).toEqual({ closed: true });
    expect(
      parseFiltersFromSearchParams(new URLSearchParams({ closed: "false" })),
    ).toEqual({ closed: false });
    expect(
      parseFiltersFromSearchParams(new URLSearchParams({ closed: "foo" })),
    ).toEqual({});
    expect(
      parseFiltersFromSearchParams(new URLSearchParams({ closed: "" })),
    ).toEqual({});
  });

  it("maps search term verbatim (case preserved)", () => {
    const sp = new URLSearchParams({ search: "Juan Pérez" });
    expect(parseFiltersFromSearchParams(sp)).toEqual({ search: "Juan Pérez" });
  });

  it("combines multiple params into one object", () => {
    const sp = new URLSearchParams({
      vendor: "Vera",
      industry: "E-commerce",
      closed: "true",
      search: "ada",
    });
    expect(parseFiltersFromSearchParams(sp)).toEqual({
      assignedSeller: "Vera",
      industry: "E-commerce",
      closed: true,
      search: "ada",
    });
  });

  it("accepts a plain Record<string, string | string[] | undefined> too", () => {
    const sp = {
      vendor: "Toro",
      industry: ["Salud", "Educación"],
      size: undefined,
      closed: "true",
    };
    expect(parseFiltersFromSearchParams(sp)).toEqual({
      assignedSeller: "Toro",
      industry: "Salud",
      closed: true,
    });
  });
});

describe("metricFiltersOf", () => {
  it("strips `search` (metrics are categorical only)", () => {
    expect(
      metricFiltersOf({
        assignedSeller: "Toro",
        industry: "Tecnología",
        search: "anything",
      }),
    ).toEqual({
      assignedSeller: "Toro",
      industry: "Tecnología",
    });
  });

  it("returns the same shape when no search is set", () => {
    expect(
      metricFiltersOf({ assignedSeller: "Toro", closed: true }),
    ).toEqual({ assignedSeller: "Toro", closed: true });
  });
});
