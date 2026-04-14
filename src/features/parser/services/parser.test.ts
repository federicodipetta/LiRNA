import { describe, expect, it } from "vitest";
import { parseWorkbenchInput } from "./parser";

describe("parser workbench validation", () => {
  it("accepts pairs with indices within the sequence range", () => {
    const result = parseWorkbenchInput("AUAUA", "(0,1);(1,4)", "l>");

    expect(result.issues).toEqual([]);
    expect(result.data).not.toBeNull();
  });

  it("reports an error when a pair exceeds the sequence length", () => {
    const result = parseWorkbenchInput("AUAUA", "(0,1);(1,5)", "l>");

    expect(result.data).toBeNull();
    expect(result.issues.some((issue) => issue.field === "pairs")).toBe(true);
    expect(result.issues[0]?.message).toContain("between 0 and 4");
  });

  it("rejects sequences containing characters other than A, C, G, and U", () => {
    const result = parseWorkbenchInput("AUXGA", "(1,2)", "l>");

    expect(result.data).toBeNull();
    expect(result.issues.some((issue) => issue.field === "sequence")).toBe(true);
    expect(result.issues[0]?.message).toContain("only A, C, G, and U");
  });
});
