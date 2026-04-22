import { describe, expect, it } from "vitest";

import { parseLtlFormula } from "../parser";

describe("lirna-seq-parser", () => {
  it("parses OR as left-associative", () => {
    const parsed = parseLtlFormula("A | C | G");

    expect(parsed.error).toBeUndefined();
    expect(parsed.formula).toEqual({
      kind: "or",
      left: {
        kind: "or",
        left: { kind: "atom", value: "A" },
        right: { kind: "atom", value: "C" },
      },
      right: { kind: "atom", value: "G" },
    });
  });

  it("parses UNTIL as right-associative", () => {
    const parsed = parseLtlFormula("A U C U G");

    expect(parsed.error).toBeUndefined();
    expect(parsed.formula).toEqual({
      kind: "until",
      left: { kind: "atom", value: "A" },
      right: {
        kind: "until",
        left: { kind: "atom", value: "C" },
        right: { kind: "atom", value: "G" },
      },
    });
  });

  it("gives unary operators higher precedence than OR", () => {
    const parsed = parseLtlFormula("!A | O(C)");

    expect(parsed.error).toBeUndefined();
    expect(parsed.formula).toEqual({
      kind: "or",
      left: { kind: "not", formula: { kind: "atom", value: "A" } },
      right: { kind: "next", formula: { kind: "atom", value: "C" } },
    });
  });

  it("parses AND with higher precedence than OR", () => {
    const parsed = parseLtlFormula("A | C & G");

    expect(parsed.error).toBeUndefined();
    expect(parsed.formula).toEqual({
      kind: "or",
      left: { kind: "atom", value: "A" },
      right: {
        kind: "and",
        left: { kind: "atom", value: "C" },
        right: { kind: "atom", value: "G" },
      },
    });
  });

  it("parses always operator [] as unary", () => {
    const parsed = parseLtlFormula("[]A");

    expect(parsed.error).toBeUndefined();
    expect(parsed.formula).toEqual({
      kind: "always",
      formula: { kind: "atom", value: "A" },
    });
  });

  it("translates formula |> label into <>((label<) & O(formula))", () => {
    const parsed = parseLtlFormula("A |> l");

    expect(parsed.error).toBeUndefined();
    expect(parsed.formula).toEqual({
      kind: "eventually",
      formula: {
        kind: "and",
        left: {
          kind: "rho",
          rho: { kind: "down", label: "l" },
        },
        right: {
          kind: "next",
          formula: { kind: "atom", value: "A" },
        },
      },
    });
  });

  it("returns parse error on missing closing parenthesis", () => {
    const parsed = parseLtlFormula("(A | C");

    expect(parsed.formula).toBeNull();
    expect(parsed.error).toContain("Expected RPAREN");
  });

  it("returns friendly error on empty input", () => {
    const parsed = parseLtlFormula("   ");

    expect(parsed.formula).toBeNull();
    expect(parsed.error).toBe("Enter an LTL formula.");
  });
});

