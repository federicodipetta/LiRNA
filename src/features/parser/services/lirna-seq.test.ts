import { describe, expect, it } from "vitest";
import {
  FALSE,
  buildSatContext,
  formatConstraint,
  formatFormula,
  parseLtlFormula,
  sat,
  satEventually,
  satNext,
  satNot,
  satOr,
  satRho,
  satTop,
  satUntil,
  type SatSet,
} from "./lirna-seq";

describe("ltl sat draft", () => {
  it("satTop covers the whole temporal horizon", () => {
    expect(satTop(4)).toMatchObject([{ range: [0, 4], constraint: { kind: "true" } }]);
  });

  it("parses and evaluates a bare RNA atom like A", () => {
    const parsed = parseLtlFormula("A");

    expect(parsed.error).toBeUndefined();
    expect(parsed.formula).toEqual({ kind: "atom", value: "A" });

    const satSet = sat(
      buildSatContext("ACGA", []),
      parsed.formula ?? { kind: "false" },
    );

    expect(satSet).toMatchObject([
      { range: [0, 0], constraint: { kind: "true" } },
      { range: [3, 3], constraint: { kind: "true" } },
    ]);
  });

  it("satRho generates assignment constraints l = k over arcs", () => {
    const context = buildSatContext("ACGUACGUAC", [
      [1, 4],
      [2, 7],
      [6, 8],
    ]);

    expect(satRho(context, { kind: "up", label: "l" })).toMatchObject([
      { range: [1, 1], constraint: { kind: "atom", label: "l", value: "1" } },
      { range: [2, 2], constraint: { kind: "atom", label: "l", value: "2" } },
      { range: [6, 6], constraint: { kind: "atom", label: "l", value: "3" } },
    ]);

    expect(satRho(context, { kind: "down", label: "x" })).toMatchObject([
      { range: [4, 4], constraint: { kind: "atom", label: "x", value: "1" } },
      { range: [7, 7], constraint: { kind: "atom", label: "x", value: "2" } },
      { range: [8, 8], constraint: { kind: "atom", label: "x", value: "3" } },
    ]);
  });

  it("satRho keeps temporal ordering even when input pairs are unsorted", () => {
    const context = buildSatContext("ACGUACGUAC", [
      [6, 8],
      [1, 4],
      [2, 7],
    ]);

    expect(satRho(context, { kind: "up", label: "l" })).toMatchObject([
      { range: [1, 1], constraint: { kind: "atom", label: "l", value: "2" } },
      { range: [2, 2], constraint: { kind: "atom", label: "l", value: "3" } },
      { range: [6, 6], constraint: { kind: "atom", label: "l", value: "1" } },
    ]);

    expect(satRho(context, { kind: "down", label: "l" })).toMatchObject([
      { range: [4, 4], constraint: { kind: "atom", label: "l", value: "2" } },
      { range: [7, 7], constraint: { kind: "atom", label: "l", value: "3" } },
      { range: [8, 8], constraint: { kind: "atom", label: "l", value: "1" } },
    ]);
  });

  it("satNext shifts by 1 and discards out-of-range intervals", () => {
    const source: SatSet = [
      { range: [0, 0], constraint: { kind: "atom", label: "a", value: 1 } },
      { range: [2, 3], constraint: { kind: "atom", label: "b", value: 1 } },
    ];

    expect(satNext(source)).toMatchObject([{ range: [1, 2], constraint: { kind: "atom", label: "b", value: 1 } }]);
  });

  it("satOr merges constraints over elementary intervals", () => {
    const left: SatSet = [{ range: [1, 3], constraint: { kind: "atom", label: "A", value: 1 } }];
    const right: SatSet = [{ range: [2, 4], constraint: { kind: "atom", label: "B", value: 1 } }];

    expect(satOr(5, left, right)).toMatchObject([
      { range: [1, 1], constraint: { kind: "atom", label: "A", value: 1 } },
      {
        range: [2, 3],
        constraint: {
          kind: "or",
          left: { kind: "atom", label: "A", value: 1 },
          right: { kind: "atom", label: "B", value: 1 },
        },
      },
      { range: [4, 4], constraint: { kind: "atom", label: "B", value: 1 } },
    ]);
  });

  it("satEventually accumulates from the future toward the past", () => {
    const source: SatSet = [
      { range: [1, 1], constraint: { kind: "atom", label: "A", value: 1 } },
      { range: [3, 3], constraint: { kind: "atom", label: "B", value: 1 } },
    ];

    expect(satEventually(4, source)).toMatchObject([
      {
        range: [0, 1],
        constraint: {
          kind: "or",
          left: { kind: "atom", label: "B", value: 1 },
          right: { kind: "atom", label: "A", value: 1 },
        },
      },
      { range: [2, 3], constraint: { kind: "atom", label: "B", value: 1 } },
    ]);
  });

  it("satNot adds the complement and negates covered constraints", () => {
    const source: SatSet = [{ range: [1, 2], constraint: { kind: "atom", label: "A", value: 1 } }];

    expect(satNot(4, source)).toMatchObject([
      { range: [0, 0], constraint: { kind: "true" } },
      { range: [1, 2], constraint: { kind: "not", expr: { kind: "atom", label: "A", value: 1 } } },
      { range: [3, 4], constraint: { kind: "true" } },
    ]);
  });

  it("satUntil uses the recurrence v2 OR (v1 AND next)", () => {
    const s1: SatSet = [{ range: [0, 3], constraint: { kind: "atom", label: "P", value: 1 } }];
    const s2: SatSet = [{ range: [2, 2], constraint: { kind: "atom", label: "Q", value: 1 } }];

    expect(satUntil(3, s1, s2)).toMatchObject([
      {
        range: [0, 1],
        constraint: {
          kind: "and",
          left: { kind: "atom", label: "P", value: 1 },
          right: { kind: "atom", label: "Q", value: 1 },
        },
      },
      { range: [2, 2], constraint: { kind: "atom", label: "Q", value: 1 } },
    ]);
  });

  it("sat evaluates a composed formula", () => {
    const output = sat(
      buildSatContext("ACGU", [
        [0, 2],
        [1, 3],
      ]),
      {
        kind: "eventually",
        formula: {
          kind: "or",
          left: { kind: "rho", rho: { kind: "up", label: "l" } },
          right: { kind: "next", formula: { kind: "rho", rho: { kind: "down", label: "l" } } },
        },
      },
    );

    expect(output.length).toBeGreaterThan(0);
    expect(output.some((entry) => entry.constraint.kind !== FALSE.kind)).toBe(true);
  });

  it("parseLtlFormula supports !, O, <>, U and l>/l< atoms", () => {
    const parsed = parseLtlFormula("<>(l> U O(l< | true))");

    expect(parsed.error).toBeUndefined();
    expect(parsed.formula).not.toBeNull();
    expect(parsed.formula && formatFormula(parsed.formula)).toBe("<>((l> U O((l< | true))))");
  });

  it("formatConstraint exposes true/false instead of top/bottom", () => {
    expect(formatConstraint({ kind: "true" })).toBe("true");
    expect(formatConstraint({ kind: "false" })).toBe("false");
    expect(formatConstraint({ kind: "atom", label: "l", value: 1 })).toBe("l = 1");
  });

  it("simplifies contradictory constraints", async () => {
    const { simplifyConstraint, andConstraint, negateConstraint, evaluateConstraint } = await import("./constraint-expr");

    expect(
      simplifyConstraint(
        andConstraint(
          { kind: "atom", label: "l", value: 1 },
          { kind: "atom", label: "l", value: 2 },
        ),
      ),
    ).toMatchObject({ kind: "false" });

    expect(negateConstraint({ kind: "true" })).toMatchObject({ kind: "false" });
    expect(evaluateConstraint({ kind: "atom", label: "l", value: 1 }, { l: 1 })).toBe(true);
  });
});

