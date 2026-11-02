import { describe, expect, it } from "vitest";
import { normalizeSequence, parseSequence, validateSequence } from "./index.js";

describe("@lirna/sequence", () => {
  it("normalizes whitespace and case", () => {
    expect(normalizeSequence(" a u\nG ")).toBe("AUG");
  });

  it("validates RNA bases", () => {
    expect(validateSequence("AUGC")).toBeNull();
    expect(validateSequence("AUGX")).toContain("only A, C, G, and U");
  });

  it("returns a structured parsing result", () => {
    expect(parseSequence("AUG")).toEqual({ sequence: "AUG" });
    expect(parseSequence("AUX")).toEqual({
      sequence: "AUX",
      issue: "The sequence may contain only A, C, G, and U.",
    });
  });
});
