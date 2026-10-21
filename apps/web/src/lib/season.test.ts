import { describe, expect, it } from "vitest";
import { SEASON_SCRIPT, isHalloween } from "./season";

describe("isHalloween", () => {
  it("covers 21 Oct through 1 Nov", () => {
    expect(isHalloween(new Date(2026, 9, 21))).toBe(true);
    expect(isHalloween(new Date(2026, 9, 31))).toBe(true);
    expect(isHalloween(new Date(2026, 10, 1))).toBe(true);
  });

  it("is off outside the window", () => {
    expect(isHalloween(new Date(2026, 9, 20))).toBe(false);
    expect(isHalloween(new Date(2026, 10, 2))).toBe(false);
    expect(isHalloween(new Date(2026, 5, 15))).toBe(false);
  });

  it("uses the same window in the pre-paint script", () => {
    for (const [month, day] of [[9, 20], [9, 21], [10, 1], [10, 2], [11, 25]]) {
      const date = new Date(2026, month, day);
      const doc = { documentElement: { dataset: {} as Record<string, string> } };
      // Run the script against a fixed date by shadowing Date.
      const FixedDate = class extends Date {
        constructor() {
          super(date.getTime());
        }
      };
      new Function("document", "Date", SEASON_SCRIPT)(doc, FixedDate);
      expect(doc.documentElement.dataset.season === "halloween").toBe(isHalloween(date));
    }
  });
});
