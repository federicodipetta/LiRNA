import { describe, expect, it } from "vitest";
import {
  andConstraint,
  evaluateConstraint,
  formatConstraint,
  negateConstraint,
  orConstraint,
  simplifyConstraint,
} from "./constraint-expr";

describe("constraint algebra", () => {
  it("discards contradictions and simplifies double negations", () => {
    expect(
      simplifyConstraint(
        andConstraint(
          { kind: "atom", label: "l", value: 1 },
          { kind: "atom", label: "l", value: 2 },
        ),
      ),
    ).toEqual({ kind: "false" });

    expect(simplifyConstraint(negateConstraint(negateConstraint({ kind: "true" })))).toEqual({ kind: "true" });
  });

  it("evaluates constraints on a partial or complete assignment", () => {
    const atom = { kind: "atom", label: "l", value: 1 } as const;

    expect(evaluateConstraint(atom, { l: 1 })).toBe(true);
    expect(evaluateConstraint(atom, { l: 2 })).toBe(false);
    expect(evaluateConstraint(atom, {})).toBeUndefined();
    expect(formatConstraint(orConstraint(atom, { kind: "false" }))).toBe("l = 1");
  });
});
