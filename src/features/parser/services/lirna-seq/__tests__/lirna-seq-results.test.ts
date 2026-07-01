import { describe, it} from "vitest";
import { buildSatContext, sat, toReadableSatSet } from "../evaluetor-full";
import { parseLtlFormula } from "../parser";

const TRIPLE_HELIX_FORMULA = `
A n1 A n2 A n3 (l1> && 'U'
 && O( l2> && 'U'
  && O(l3> && 'U'))) 
&& <>(l1< && 'A') 
&& <>(l2< && 'A') 
&& <>(l3< && 'A') 
&& <>(!n1< && !n1> && 'U' 
 && O(!n2< && !n2> && 'U' 
 && O(!n3< && !n3> && 'U' 
)))
 `;

let result = parseLtlFormula(TRIPLE_HELIX_FORMULA);

if (result.error) {
    console.error(`Error parsing formula: ${result.error}`);
    throw new Error(`Error parsing formula: ${result.error}`);
}

const LiRNA_TRIPLE_HELIX = result.formula!;

type Molecule =  {
    name: string;
    structure: string;
    bonds: [index1: number, index2: number][];
};

let molecules: Molecule[] = [
    {
        name: "4plx",
        structure: "GGAAGGUUUUUCUUUUCCUGAGGCGAAAGUCUCAGGUUUUGCUUUUUGGCCUUUCUUAAAAAAAAAAAAAGCAAAA",
        bonds: [[25,28],[24,29],[23,30],[22,31],[21,32],[20,33],[19,34],[18,35],[17,36],[6,50],[5,51],[4,52],[3,53],[2,54],[47,66],[46,67],[45,68],[44,69],[43,70],[42,71],[41,72],[40,73],[39,74],[38,75],[37,76]]
    }
];

molecules.forEach((molecule) => {
    molecule.bonds.sort((a, b) => a[0] - b[0]);
});

describe("TEST for generating JSON for 4plx", () => {
    it("should generate the correct JSON for 4plx", async () => {
        
        let _4plx = molecules.find(molecule => molecule.name === "4plx");
    
        let ssat = sat(buildSatContext(_4plx!.structure, _4plx!.bonds), LiRNA_TRIPLE_HELIX);
        let readableSatSet = await toReadableSatSet(ssat,
            new Set([]),
            _4plx!.structure.length - 1,
        );
        // Write the result to a JSON file
        const fs: any = await import("fs");
        fs.writeFileSync("4plx.json", JSON.stringify(readableSatSet, null, 2));
    });
})