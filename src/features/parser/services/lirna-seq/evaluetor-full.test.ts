import { it, describe, expect } from "vitest";

import { AlignSatSets, BasePair, buildSatContextFromBasePairs, cutSatContext, satAt, satAtom, SatContext, satEventually, satRho, SatSet, satTrue, satUntil } from "./evaluetor-full";
import { And, Constraint, eq, FALSE, Int, Or, Solver, TRUE } from "./z3Wrapper";
import { AtomicRho, LtlFormula } from "./ast";

async function expectConstraintEquivalent(actual: Constraint, expected: Constraint) {
    const solver = new Solver();
    solver.add(Or(And(actual, expected.not()), And(actual.not(), expected)));
    let result = await solver.check();
    if (result === "sat") {
            const model = await solver.model();
            console.log("Counterexample found:");
            model.decls().forEach(decl => {
                console.log(`${decl.name()} = ${model.get(decl)}`);
            });
            console.log("Actual constraint:", actual.toString());
            console.log("Expected constraint:", expected.toString());
    }
    expect(await solver.check()).toBe("unsat");
}

async function expectSatSetEquivalent(actual: SatSet, expected: SatSet) {
    expect(actual).toHaveLength(expected.length);

    for (let index = 0; index < expected.length; index += 1) {
        expect(actual[index].timeRange).toEqual(expected[index].timeRange);
        console.log("INDEX:", index);
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
    ]);
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

    it("should evaluate satEventually correctly", async () => {
        const set = [
            {
                constraint: FALSE,
                timeRange: { start: 0, end: 2 },
            },
            {
                constraint: eq("l", 1),
                timeRange: { start: 3, end: 5 },
            },
            {
                constraint: eq("l", 2),
                timeRange: { start: 6, end: 6 },
            },
            {
                constraint: FALSE,
                timeRange: { start: 7, end: 8 },
            }
        ];
        const result = satEventually(context, set);
        await expectSatSetEquivalent(result, [
            {
                constraint: Or(eq("l", 1), eq("l", 2)),
                timeRange: { start: 0, end: 5 },
            },
            {
                constraint: eq("l", 2),
                timeRange: { start: 6, end: 6 },
            },
            {
                constraint: FALSE,
                timeRange: { start: 7, end: 8 },
            }
        ]);
    });

    it("should evaluate satUntil correctly", async () => {
        const set = [
            {
                constraint: FALSE,
                timeRange: { start: 0, end: 2 },
            },
            {
                constraint: eq("l", 1),
                timeRange: { start: 3, end: 5 },
            },
            {
                constraint: eq("l", 2),
                timeRange: { start: 6, end: 6 },
            },
            {
                constraint: FALSE,
                timeRange: { start: 7, end: 8 },
            }
        ];
        const set2 = [
            {
                constraint: FALSE,
                timeRange: { start: 0, end: 4 },
            },
            {
                constraint: eq("l", 3),
                timeRange: { start: 5, end: 5 },
            },
            {
                constraint: FALSE,
                timeRange: { start: 6, end: 8 },
            }
        ]

        const result = satUntil(context, set2, set);
        await expectSatSetEquivalent(result, [
            {
                constraint: FALSE,
                timeRange: { start: 0, end: 2 },
            },
            {
                constraint: eq("l", 1),
                timeRange: { start: 3, end: 4 },
            },
            {
                constraint: Or(eq("l", 1), And(eq("l", 3), eq("l", 1))),
                timeRange: { start: 5, end: 5 },
            },
            {
                constraint: eq("l", 2),
                timeRange: { start: 6, end: 6 },
            },
            {
                constraint: FALSE,
                timeRange: { start: 7, end: 8 },
            }
        ]);
    });


    it("should evaluate satAt correctly", async () => {
        const formula = { kind: "atom", value: "U" } as LtlFormula;
        const result = satAt(context, formula, "l");
        console.log(JSON.stringify(result, null, 2));
        await expectSatSetEquivalent(result, [
            {
                constraint: eq("l", 1).or(eq("l", 3)),
                timeRange: { start: 0, end: 0 },
            },
            {
                constraint: eq("l", 3),
                timeRange: { start: 1, end: 1 },
            },
            {
                constraint: eq("l", 3),
                timeRange: { start: 2, end: 2 },
            },
            {
                constraint: FALSE,
                timeRange: { start: 3, end: 8 },
            },
        ]);

    });

    it("should align SatSets by splitting on the earliest end boundary", async () => {
        const s1: SatSet = [
        { constraint: TRUE, timeRange: { start: 0, end: 2 } },
        { constraint: FALSE, timeRange: { start: 3, end: 5 } },
        ];
        const s2: SatSet = [
            { constraint: FALSE, timeRange: { start: 0, end: 1 } },
            { constraint: TRUE, timeRange: { start: 2, end: 5 } },
        ];

        const [alignedS1, alignedS2] = AlignSatSets(s1, s2);

        await expectSatSetEquivalent(alignedS1, [
            { constraint: TRUE, timeRange: { start: 0, end: 1 } },
            { constraint: TRUE, timeRange: { start: 2, end: 2 } },
            { constraint: FALSE, timeRange: { start: 3, end: 5 } },
        ]);

        await expectSatSetEquivalent(alignedS2, [
            { constraint: FALSE, timeRange: { start: 0, end: 1 } },
            { constraint: TRUE, timeRange: { start: 2, end: 2 } },
            { constraint: TRUE, timeRange: { start: 3, end: 5 } },
        ]);
    });

    it("should cut SatContext correctly", async () => {
        const cutContext = cutSatContext(context, 2, 5);
        expect(cutContext.sequence).toBe("UAUA");
        expect(cutContext.sequenceStart).toBe(0);
        expect(cutContext.sequenceLength).toBe(3);
        expect(cutContext.bonsFromStart).toStrictEqual([
                { id: "3", start: 1, end: 4 },
                { id: "4", start: 2, end: 3 },
        ]);
        expect(cutContext.bonsFromEnd).toStrictEqual([
                { id: "4", start: 2, end: 3 },
                { id: "3", start: 1, end: 4 },
        ]);
    });
            
});
