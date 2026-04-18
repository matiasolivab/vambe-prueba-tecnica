import { describe, expect, it } from "vitest";

import {
  formatYearMonthEs,
  previousYearMonth,
} from "@/shared/date/format-month-es";

describe("formatYearMonthEs", () => {
  it("formats a valid YYYY-MM as abbreviated Spanish month + apostrophed year", () => {
    expect(formatYearMonthEs("2026-04")).toBe("Abr '26");
  });

  it("formats December as 'Dic' + previous century-less year", () => {
    expect(formatYearMonthEs("2025-12")).toBe("Dic '25");
  });

  it("supports pre-2000 years by keeping the last two digits", () => {
    expect(formatYearMonthEs("1999-03")).toBe("Mar '99");
  });

  it("covers all twelve months with the Spanish abbreviations", () => {
    const expected = [
      "Ene",
      "Feb",
      "Mar",
      "Abr",
      "May",
      "Jun",
      "Jul",
      "Ago",
      "Sep",
      "Oct",
      "Nov",
      "Dic",
    ];
    for (let i = 0; i < 12; i++) {
      const mm = String(i + 1).padStart(2, "0");
      expect(formatYearMonthEs(`2026-${mm}`)).toBe(`${expected[i]} '26`);
    }
  });

  it("returns an em-dash for an empty input (absent-data sentinel)", () => {
    expect(formatYearMonthEs("")).toBe("—");
  });

  it("returns the raw string when the separator is not a hyphen", () => {
    expect(formatYearMonthEs("2026/04")).toBe("2026/04");
  });

  it("returns the raw string when the input is not YYYY-MM at all", () => {
    expect(formatYearMonthEs("abril 2026")).toBe("abril 2026");
  });

  it("returns the raw string when the month is out of range (13)", () => {
    expect(formatYearMonthEs("2026-13")).toBe("2026-13");
  });

  it("returns the raw string when the month is zero", () => {
    expect(formatYearMonthEs("2026-00")).toBe("2026-00");
  });
});

describe("previousYearMonth", () => {
  it("subtracts one month within the same year", () => {
    expect(previousYearMonth("2026-04")).toBe("2026-03");
  });

  it("crosses year boundary when input is January", () => {
    expect(previousYearMonth("2026-01")).toBe("2025-12");
  });

  it("returns an empty string for empty input", () => {
    expect(previousYearMonth("")).toBe("");
  });

  it("returns an empty string for invalid input", () => {
    expect(previousYearMonth("2026/04")).toBe("");
  });
});
