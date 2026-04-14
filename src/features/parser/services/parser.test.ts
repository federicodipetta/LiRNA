import { describe, expect, it } from "vitest";
import { parseWorkbenchInput } from "./parser";

describe("parser workbench validation", () => {
  it("accepts pairs with indices within the sequence range", () => {
    const result = parseWorkbenchInput("AUAUA", "(1,2);(2,5)", "l↑");

    expect(result.issues).toEqual([]);
    expect(result.data).not.toBeNull();
  });

  it("reports an error when a pair exceeds the sequence length", () => {
    const result = parseWorkbenchInput("AUAUA", "(1,2);(2,6)", "l↑");

    expect(result.data).toBeNull();
    expect(result.issues.some((issue) => issue.field === "pairs")).toBe(true);
    expect(result.issues[0]?.message).toContain("indices between 1 and 5");
  });

  it("rejects sequences containing characters other than A, C, G, and U", () => {
    const result = parseWorkbenchInput("AUXGA", "(1,2)", "l↑");

    expect(result.data).toBeNull();
    expect(result.issues.some((issue) => issue.field === "sequence")).toBe(true);
    expect(result.issues[0]?.message).toContain("only A, C, G, and U");
  });
});
