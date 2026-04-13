import { describe, expect, it } from "vitest";
import {
  BOTTOM,
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
} from "./ltl-sat";

describe("ltl sat draft", () => {
  it("satTop copre tutto l'orizzonte temporale", () => {
    expect(satTop(4)).toEqual([{ range: [0, 4], constraint: { kind: "top" } }]);
  });

  it("satRho genera vincoli puntuali per up/down", () => {
    expect(satRho(3, { kind: "up", label: "l" })).toEqual([
      { range: [1, 1], constraint: { kind: "atom", value: "arc(l).start_1 > arc(l).start_0" } },
      { range: [2, 2], constraint: { kind: "atom", value: "arc(l).start_2 > arc(l).start_1" } },
      { range: [3, 3], constraint: { kind: "atom", value: "arc(l).start_3 > arc(l).start_2" } },
    ]);

    expect(satRho(2, { kind: "down", label: "x" })).toEqual([
      { range: [1, 1], constraint: { kind: "atom", value: "arc(x).end_1 < arc(x).end_0" } },
      { range: [2, 2], constraint: { kind: "atom", value: "arc(x).end_2 < arc(x).end_1" } },
    ]);
  });

  it("satNext trasla indietro di 1 e scarta intervalli che escono", () => {
    const source: SatSet = [
      { range: [0, 0], constraint: { kind: "atom", value: "a" } },
      { range: [2, 3], constraint: { kind: "atom", value: "b" } },
    ];

    expect(satNext(source)).toEqual([{ range: [1, 2], constraint: { kind: "atom", value: "b" } }]);
  });

  it("satOr unisce i vincoli sui tratti elementari", () => {
    const left: SatSet = [{ range: [1, 3], constraint: { kind: "atom", value: "A" } }];
    const right: SatSet = [{ range: [2, 4], constraint: { kind: "atom", value: "B" } }];

    expect(satOr(5, left, right)).toEqual([
      { range: [1, 1], constraint: { kind: "atom", value: "A" } },
      {
        range: [2, 3],
        constraint: {
          kind: "or",
          left: { kind: "atom", value: "A" },
          right: { kind: "atom", value: "B" },
        },
      },
      { range: [4, 4], constraint: { kind: "atom", value: "B" } },
    ]);
  });

  it("satEventually accumula dal futuro verso il passato", () => {
    const source: SatSet = [
      { range: [1, 1], constraint: { kind: "atom", value: "A" } },
      { range: [3, 3], constraint: { kind: "atom", value: "B" } },
    ];

    expect(satEventually(4, source)).toEqual([
      {
        range: [0, 1],
        constraint: {
          kind: "or",
          left: { kind: "atom", value: "B" },
          right: { kind: "atom", value: "A" },
        },
      },
      { range: [2, 3], constraint: { kind: "atom", value: "B" } },
    ]);
  });

  it("satNot aggiunge complemento e nega i vincoli coperti", () => {
    const source: SatSet = [{ range: [1, 2], constraint: { kind: "atom", value: "A" } }];

    expect(satNot(4, source)).toEqual([
      { range: [0, 0], constraint: { kind: "top" } },
      { range: [1, 2], constraint: { kind: "not", expr: { kind: "atom", value: "A" } } },
      { range: [3, 4], constraint: { kind: "top" } },
    ]);
  });

  it("satUntil usa la ricorrenza v2 OR (v1 AND next)", () => {
    const s1: SatSet = [{ range: [0, 3], constraint: { kind: "atom", value: "P" } }];
    const s2: SatSet = [{ range: [2, 2], constraint: { kind: "atom", value: "Q" } }];

    expect(satUntil(3, s1, s2)).toEqual([
      {
        range: [0, 1],
        constraint: {
          kind: "and",
          left: { kind: "atom", value: "P" },
          right: { kind: "atom", value: "Q" },
        },
      },
      { range: [2, 2], constraint: { kind: "atom", value: "Q" } },
    ]);
  });

  it("sat valuta una formula composta", () => {
    const output = sat(4, {
      kind: "eventually",
      formula: {
        kind: "or",
        left: { kind: "rho", rho: { kind: "up", label: "l" } },
        right: { kind: "next", formula: { kind: "rho", rho: { kind: "down", label: "l" } } },
      },
    });

    expect(output.length).toBeGreaterThan(0);
    expect(output.some((entry) => entry.constraint.kind !== BOTTOM.kind)).toBe(true);
  });

  it("parseLtlFormula supporta !, O, <>, U e atomi l↑/l↓", () => {
    const parsed = parseLtlFormula("<>(l↑ U O(l\\downarrow | true))");

    expect(parsed.error).toBeUndefined();
    expect(parsed.formula).not.toBeNull();
    expect(parsed.formula && formatFormula(parsed.formula)).toBe("<>((l↑ U O((l↓ | true))))");
  });

  it("formatConstraint espone true/false al posto di top/bottom", () => {
    expect(formatConstraint({ kind: "top" })).toBe("true");
    expect(formatConstraint({ kind: "bottom" })).toBe("false");
  });
});
