import {it, describe, expect} from "vitest";
import { BasePair, SatContext, satTrue } from "./evaluetor-full";

const mockBonds: BasePair[] = [
    [2, 3],
    [1, 4],
    [5, 10],
    [6, 9],
];
// lenght = 16
const mockSequence = "AUGCUGAACUCUCUU";

const mockContext: SatContext = {
    sequenceLength: mockSequence.length - 1,
    sequence: mockSequence,
    bonsFromEnd: mockBonds,
    bonsFromStart: mockBonds,
    numberOfVariables: 0,

}

describe("test constraint set", () => {
    it("should correctly apply true operator", () => {
        expect(satTrue(mockContext)).toEqual([
            []
        ]);
    })
})