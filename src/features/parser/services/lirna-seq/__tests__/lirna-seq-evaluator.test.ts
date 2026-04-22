import { describe, expect, it } from "vitest";

import {
  buildSatContext,
  sat,
  satAlways,
  satAnd,
  satAtom,
  satEventually,
  satNot,
  satTop,
  satUntil,
  type SatSet,
} from "../evaluator";

describe("lirna-seq-evaluator", () => {
  it("satTop returns empty set for negative horizon", () => {
    expect(satTop(-1)).toEqual([]);
  });

  it("satAtom marks matching timestamps only", () => {
    const ctx = buildSatContext("ACGA", []);

    expect(satAtom(ctx, "A")).toEqual([
      { range: [0, 0], constraint: { kind: "true", simplified: true } },
      { range: [3, 3], constraint: { kind: "true", simplified: true } },
    ]);
  });

  it("satEventually returns empty on empty input", () => {
    expect(satEventually(5, [])).toEqual([]);
  });

  it("satAnd intersects constraints over elementary intervals", () => {
    const left: SatSet = [{ range: [1, 3], constraint: { kind: "atom", label: "L", value: 1 } }];
    const right: SatSet = [{ range: [2, 4], constraint: { kind: "atom", label: "R", value: 1 } }];

    expect(satAnd(5, left, right)).toEqual([
      {
        range: [2, 3],
        constraint: {
          kind: "and",
          left: { kind: "atom", label: "L", value: 1, simplified: true },
          right: { kind: "atom", label: "R", value: 1, simplified: true },
          simplified: true,
        },
      },
    ]);
  });

  it("satNot complements uncovered timeline segments", () => {
    const source: SatSet = [{ range: [2, 3], constraint: { kind: "atom", label: "p", value: 1 } }];

    expect(satNot(5, source)).toEqual([
      { range: [0, 1], constraint: { kind: "true", simplified: true } },
      {
        range: [2, 3],
        constraint: {
          kind: "not",
          expr: { kind: "atom", label: "p", value: 1, simplified: true },
          simplified: true,
        },
      },
      { range: [4, 5], constraint: { kind: "true", simplified: true } },
    ]);
  });

  it("satUntil computes recurrence backward", () => {
    const left: SatSet = [{ range: [0, 2], constraint: { kind: "atom", label: "L", value: 1 } }];
    const right: SatSet = [{ range: [1, 1], constraint: { kind: "atom", label: "R", value: 1 } }];

    expect(satUntil(2, left, right)).toEqual([
      {
        range: [0, 0],
        constraint: {
          kind: "and",
          left: { kind: "atom", label: "L", value: 1, simplified: true },
          right: { kind: "atom", label: "R", value: 1, simplified: true },
          simplified: true,
        },
      },
      { range: [1, 1], constraint: { kind: "atom", label: "R", value: 1, simplified: true } },
    ]);
  });

  it("sat evaluates false to an empty set", () => {
    const ctx = buildSatContext("ACGU", []);

    expect(sat(ctx, { kind: "false" })).toEqual([]);
  });

  it("satAlways is equivalent to not(eventually(not(phi)))", () => {
    const source: SatSet = [{ range: [1, 2], constraint: { kind: "atom", label: "A", value: 1 } }];

    expect(satAlways(3, source)).toEqual(
      satNot(3, satEventually(3, satNot(3, source))),
    );
  });

  it("sat evaluates always/and formulas", () => {
    const ctx = buildSatContext("ACGA", []);

    const result = sat(ctx, {
      kind: "always",
      formula: {
        kind: "and",
        left: { kind: "atom", value: "A" },
        right: { kind: "atom", value: "C" },
      },
    });

    expect(result).toEqual([]);
  });
});

