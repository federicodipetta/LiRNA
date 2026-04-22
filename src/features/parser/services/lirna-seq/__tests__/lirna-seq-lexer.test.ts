import { describe, expect, it } from "vitest";

import { tokenizeFormula } from "../lexer";

describe("lirna-seq-lexer", () => {
  it("tokenizes unary/binary operators and delimiters", () => {
    const tokens = tokenizeFormula("[](!(A & O(C)))");

    expect(tokens.map((t) => t.type)).toEqual([
      "ALWAYS",
      "LPAREN",
      "NOT",
      "LPAREN",
      "ATOM",
      "AND",
      "NEXT",
      "LPAREN",
      "ATOM",
      "RPAREN",
      "RPAREN",
      "RPAREN",
      "EOF",
    ]);
  });

  it("tokenizes pipe implication and right-hand label", () => {
    const tokens = tokenizeFormula("A |> l");

    expect(tokens.map((t) => t.type)).toEqual(["ATOM", "PIPE_IMPL", "LABEL", "EOF"]);
    expect(tokens.find((t) => t.type === "LABEL")?.value).toBe("l");
  });

  it("accepts unquoted A/C/G and quoted U atoms", () => {
    const unquoted = tokenizeFormula("A | C | G");
    const quoted = tokenizeFormula("'A' | \"U\"");

    expect(unquoted.filter((t) => t.type === "ATOM").map((t) => t.value)).toEqual(["A", "C", "G"]);
    expect(quoted.filter((t) => t.type === "ATOM").map((t) => t.value)).toEqual(["A", "U"]);
  });

  it("supports rho direction forms (> < up down arrows)", () => {
    const tokens = tokenizeFormula("l> | x< | y up | z down | a ↑ | b ↓");
    const rho = tokens.filter((t) => t.type === "RHO");

    expect(rho.map((t) => t.rho)).toEqual([
      { kind: "up", label: "l" },
      { kind: "down", label: "x" },
      { kind: "up", label: "y" },
      { kind: "down", label: "z" },
      { kind: "up", label: "a" },
      { kind: "down", label: "b" },
    ]);
  });

  it("throws on unterminated quoted atom", () => {
    expect(() => tokenizeFormula("'A")).toThrow("Unterminated quoted atom");
  });

  it("throws with position on invalid token", () => {
    expect(() => tokenizeFormula("A ? B")).toThrow("Invalid token at position 3");
  });
});

