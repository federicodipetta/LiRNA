import { it, describe, expect } from "vitest";

import { BasePair, buildSatContextFromBasePairs, satAtom, SatContext, satRho, SatSet, satTrue } from "./evaluetor-full";
import { And, Constraint, eq, FALSE, Or, Solver, TRUE } from "./z3Wrapper";
import { AtomicRho } from "./ast";

async function expectConstraintEquivalent(actual: Constraint, expected: Constraint) {
    const solver = new Solver();
    solver.add(Or(And(actual, expected.not()), And(actual.not(), expected)));
    expect(await solver.check()).toBe("unsat");
}

async function expectSatSetEquivalent(actual: SatSet, expected: SatSet) {
    expect(actual).toHaveLength(expected.length);

    for (let index = 0; index < expected.length; index += 1) {
        expect(actual[index].timeRange).toEqual(expected[index].timeRange);
        await expectConstraintEquivalent(actual[index].constraint, expected[index].constraint);
    }
}

describe("Evaluator with full time range", () => {
                                            //  012345678
    var context = buildSatContextFromBasePairs("AAUAUAUCG", [
        { id: "1", start: 1, end: 8 },
        { id: "2", start: 2, end: 7 },
        { id: "3", start: 3, end: 6 },
        { id: "4", start: 4, end: 5 },
    ])
    it("should evaluate satTrue correctly", async () => {
        const result = satTrue(context);
        await expectSatSetEquivalent(result, [{
            constraint: TRUE,
            timeRange: { start: 0, end: context.sequenceLength },
        }]);
    });

    it("should evaluate satAtom correctly", async () => {
        const result = satAtom(context, "A");
        await expectSatSetEquivalent(result, [
            {
                constraint: TRUE,
                timeRange: { start: 0, end: 1 },
            },
            {
                constraint: FALSE,
                timeRange: { start: 2, end: 2 },
            },
            {
                constraint: TRUE,
                timeRange: { start: 3, end: 3 },
            },
            {
                constraint: FALSE,
                timeRange: { start: 4, end: 4 },
            },
            {
                constraint: TRUE,
                timeRange: { start: 5, end: 5 },
            },
            {
                constraint: FALSE,
                timeRange: { start: 6, end: 8 },
            }]);
    });

    it("should evaluate satAtom correctly for a character not in the sequence", async () => {
        const result = satAtom(context, "Z");
        await expectSatSetEquivalent(result, [
            {
                constraint: FALSE,
                timeRange: { start: 0, end: 8 },
            }]);
    });

    it("should evaluate satRho correctly", async () => {
        const rho: AtomicRho = { kind: "up", label: "l" };
        const result = satRho(context, rho);
        await expectSatSetEquivalent(result, [
            {
                constraint: FALSE,
                timeRange: { start: 0, end: 0 },
            },
            {
                constraint: eq("l", 1),
                timeRange: { start: 1, end: 1 },
            },
            {
                constraint: eq("l", 2),
                timeRange: { start: 2, end: 2 },
            },
            {
                constraint: eq("l", 3),
                timeRange: { start: 3, end: 3 },
            },
            {
                constraint: eq("l", 4),
                timeRange: { start: 4, end: 4 },
            },
            {
                constraint: FALSE,
                timeRange: { start: 5, end: 8 },
            }
        ]);
    });
});

