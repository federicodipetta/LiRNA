import { describe, expect, it } from "vitest";
import { buildSatContext, sat, toReadableSatSet } from "../evaluetor-full";
import { parseLtlFormula } from "../parser";

const UNPAIRED_U = `
(. && 'U')
`

const TRIPLE_HELIX_FORMULA = `
<>(l1> && 'U'
 && O( l2> && 'U'
  && O(l3> && 'U'))) 
&& <>(l3< && 'A' 
&& O(l2< && 'A' 
&& O(l1< && 'A'))) 
&& <>(
    ${UNPAIRED_U}
 && O(${UNPAIRED_U}
 && O(${UNPAIRED_U}
)))
 `;

let result = parseLtlFormula(TRIPLE_HELIX_FORMULA);

if (result.error) {
    console.error(`Error parsing formula: ${result.error}`);
    throw new Error(`Error parsing formula: ${result.error}`);
}

const LiRNA_TRIPLE_HELIX = result.formula!;

type Molecule = {
    name: string;
    structure: string;
    bonds: [index1: number, index2: number][];
};

let molecules: Molecule[] = [
    {
        name: "4plx",
        structure: "GGAAGGUUUUUCUUUUCCUGAGGCGAAAGUCUCAGGUUUUGCUUUUUGGCCUUUCUUAAAAAAAAAAAAAGCAAAA",
        bonds: [[25, 28], [24, 29], [23, 30], [22, 31], [21, 32], [20, 33], [19, 34], [18, 35], [17, 36], [6, 50], [5, 51], [4, 52], [3, 53], [2, 54], [47, 66], [46, 67], [45, 68], [44, 69], [43, 70], [42, 71], [41, 72], [40, 73], [39, 74], [38, 75], [37, 76]]
    }
];

molecules.forEach((molecule) => {
    molecule.bonds.sort((a, b) => a[0] - b[0]);
});

molecules = molecules.map(m => {
    return {
        ...m,
        bonds: m.bonds.map(b => [b[0] - 1, b[1] - 1])
    }
});

const fs: any = await import("fs");
describe("TEST for generating JSON for 4plx", () => {
    it("should generate the correct JSON for 4plx", async () => {

        let _4plx = molecules.find(molecule => molecule.name === "4plx");

        let ssat = sat(buildSatContext(_4plx!.structure, _4plx!.bonds), LiRNA_TRIPLE_HELIX);
        let readableSatSet = await toReadableSatSet(ssat,
            new Set(["l1", "l2", "l3"]),
            _4plx!.structure.length - 1,
        );
        // Write the result to a JSON file
        fs.writeFileSync("4plx.json", JSON.stringify(readableSatSet, null, 2));

        expect(readableSatSet.filter(r => r.satisfied).length).toBeGreaterThan(1);
    });

    it("should find triple helix", async () => {
        let seq = "UAUUUUUUAAAAAGGGUUU"
        /*         01234567890123456789*/
        let bonds = [[3, 12], [4, 11], [5, 10], [6, 9]] as [number, number][];
        let ssat = sat(buildSatContext(seq, bonds), LiRNA_TRIPLE_HELIX);

        let result = await toReadableSatSet(ssat, new Set(["l1", "l2", "l3"]), seq.length - 1);
        fs.writeFileSync("test.json", JSON.stringify(result, null, 2));

        let expected = [
            {
                l1: { start: 3, end: 6 },
                l2: { start: 4, end: 5 },
                l3: { start: 5, end: 4 }
            }
        ];
        expect(result.filter(r => r.satisfied).length).toEqual(2);

    })
})