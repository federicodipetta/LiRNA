import { describe, expect, it } from "vitest";
import { buildSatContext, justOne, sat, toReadableSatSet } from "../evaluetor-full";
import { parseLtlFormula } from "../parser";
import { LiRNAFormula } from "../ast";

// --- FORMULA LTL ---
const UNPAIRED_U = `(. && 'U')`;

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

const NOT_PAIRED_SEQUENCE = `
[] .
`

const PSEUDOKNOT = `
(((<>l2>) && !(<> l2<)) @ l1)
`

const HAIRPIN = `
    (. && [] .) @ l
`

function parseFormula(formula: string) {
    let parseResult = parseLtlFormula(formula);
    if (parseResult.error) {
        throw new Error(`Error parsing formula: ${parseResult.error}`);
    }
    return parseResult.formula!;
}

const LiRNA_TRIPLE_HELIX = parseFormula(TRIPLE_HELIX_FORMULA);

const LiRNA_NOT_PAIRED = parseFormula(NOT_PAIRED_SEQUENCE);

const LiRNA_PSEUDOKNOT = parseFormula(PSEUDOKNOT);

const LiRNA_HAIRPIN = parseFormula(HAIRPIN);

// --- DATA STRUCTURES ---
type Molecule = {
    name: string;
    structure: string;
    bonds: [number, number][];
};

// Tutte le tue molecole convertite in sequenze e liste di legami (0-based)
const molecules: Molecule[] = [
    {
        name: "4PLX",
        structure: "GGAAGGUUUUUCUUUUCCUGAGGCGAAAGUCUCAGGUUUUGCUUUUUGGCCUUUCUUAAAAAAAAAAAAAGCAAAA",
        bonds: [[1, 53], [2, 52], [3, 51], [4, 50], [5, 49], [16, 35], [17, 34], [18, 33], [19, 32], [20, 31], [21, 30], [22, 29], [23, 28], [24, 27], [36, 75], [37, 74], [38, 73], [39, 72], [40, 71], [41, 70], [42, 69], [43, 68], [44, 67], [45, 66], [46, 65]]
    },
    {
        name: "MALAT1",
        structure: "GAAGGUUUUUCUUUUCCUGAGAAAACAACACGUAUUGUUUUCUCAGGUUUUGCUUUUUGGCCUUUUUCUAGCUUAAAAAAAAAAAAAGCAAAA",
        bonds: [[0, 53], [1, 52], [2, 51], [3, 50], [4, 49], [15, 44], [16, 43], [17, 42], [18, 41], [19, 40], [20, 39], [21, 38], [22, 37], [23, 36], [24, 35], [25, 34], [26, 33], [27, 32], [45, 91], [46, 90], [47, 89], [48, 88], [49, 87], [50, 86], [51, 85], [52, 84], [53, 83], [54, 82], [55, 81]]
    },
    {
        name: "PAN1",
        structure: "GCUGGGUUUUUCCUUCGAAAGAAGGUUUUUAUCCCAGUGUAUAAAAAAAAAAAAAAA",
        bonds: [[0, 35], [1, 34], [2, 33], [3, 32], [4, 31], [5, 30], [11, 24], [12, 23], [13, 22], [14, 21], [15, 20], [26, 56], [27, 55], [28, 54], [29, 53], [30, 52]]
    },
    {
        name: "PAN2",
        structure: "GGGUUUUUUCCUUCGAAAGAAGGUUUUUAUCCCUGCCUUCGGGCAAAAAAAA",
        bonds: [[0, 31], [1, 30], [2, 29], [7, 20], [8, 19], [9, 18], [10, 17], [11, 16], [22, 51], [23, 50], [24, 49], [25, 48], [26, 47], [32, 43], [33, 42], [34, 41], [35, 40]]
    },
    {
        name: "2M8K",
        structure: "GGUUUCUUUUUAGUGAUUUUUCCAAACCCCUUUGUGCAAAAAUCAUUA",
        bonds: [[0, 24], [1, 23], [2, 22], [3, 21], [4, 20], [11, 46], [12, 45], [13, 44], [14, 43], [15, 42], [16, 41], [17, 40], [18, 39], [19, 38], [20, 37], [22, 35]]
    },
    {
        name: "2K95",
        structure: "GGGCUGUUUUUCUCGCUGACUUUCAGCCCCAAACAAAAAAUGUCAGCA",
        bonds: [[0, 29], [1, 28], [2, 27], [3, 26], [4, 25], [5, 24], [14, 47], [15, 46], [16, 45], [17, 41], [18, 40], [19, 39], [20, 38], [21, 37], [22, 36]]
    },
    {
        name: "1YMO",
        structure: "GGGCUGUUUUUCUCGCUGACUUUCAGCCCCAAACAAAAAAGUCAGCA",
        bonds: [
            // Accoppiamenti principali (parentesi tonde)
            [0, 28],
            [1, 27],
            [2, 26],
            [3, 25],
            [4, 24],
            [5, 23],

            // Accoppiamenti del pseudonodo (parentesi quadre)
            [14, 45],
            [15, 44],
            [16, 43],
            [17, 42],
            [18, 41],
            [19, 40],
            [20, 39],
            [21, 38],
            [22, 37]
        ]
    },
    {
        name: "HTER",
        structure: "GGCCAUUUUUUGUCUAACCCUAACUGAGAAGGGCGUAGGCGCCGUGCUUUUGCUCCCCGCGGGCUGUUUUUCUCGCUGACUUUCAGCCCGCGGAAAAGCCUCGGCCUGCCGCCUUCCACCGUUCAUUCUAGAGCAAACAAAAAAUGUCAGCAGCUGGCC",
        bonds: [
            // Stem esterno principale
            [0, 158],
            [1, 157],
            [2, 156],
            [3, 155],
            [4, 154],

            // Stem interni e relative sottostrutture
            [29, 114],
            [30, 113],
            [31, 112],
            [32, 111],
            [33, 110],
            [34, 109],
            // (Nota: presente un bulge all'indice 108 '.')
            [35, 107],
            [36, 106],
            [37, 105],
            [38, 104],
            [39, 103],

            [45, 98],
            [46, 97],
            [47, 96],
            [48, 95],
            [49, 94],
            [50, 93],

            [56, 92],
            [57, 91],
            [58, 90],
            [59, 89],
            [60, 88],
            [61, 87],
            [62, 86],
            [63, 85],
            [64, 84],
            [65, 83],

            // Accoppiamenti del pseudonodo (parentesi quadre)
            [74, 150],
            [75, 149],
            [76, 148],
            [77, 147],
            [78, 146],
            [79, 145],
            // (Nota: presente un loop/bulge interno agli indici 144 e 140 '.')
            [80, 143],
            [81, 142],
            [82, 141]
        ]
    },
    {
        name: "Not_Paired",
        structure: "GGAAGGUUUUUCUUC".repeat(10), //len = 150
        bonds: []
    }
]; // Reverse per avere le molecole più piccole prima, utile per il benchmark
molecules.reverse();

function computeFormulaLength(formula: LiRNAFormula): number {
    switch (formula.kind) {
        case "true":
        case "false":
            return 1;
        case "atom":
            return 1;
        case "not":
            return 1 + computeFormulaLength(formula.formula);
        case "next":
            return 1 + computeFormulaLength(formula.formula);
        case "eventually":
            return 1 + computeFormulaLength(formula.formula);
        case "always":
            return 1 + computeFormulaLength(formula.formula);
        case "exists":
            return 1 + computeFormulaLength(formula.formula);
        case "forall":
            return 1 + computeFormulaLength(formula.formula);
        case "and":
            return 1 + computeFormulaLength(formula.left) + computeFormulaLength(formula.right);
        case "or":
            return 1 + computeFormulaLength(formula.left) + computeFormulaLength(formula.right);
        case "until":
            return 1 + computeFormulaLength(formula.left) + computeFormulaLength(formula.right);
        case "at":
            return 1 + computeFormulaLength(formula.formula);
        case "rho":
            return 1;
        case "dot":
            return 1;
        default:
            throw new Error(`Unknown formula kind: ${(formula as any).kind}`);
    }
}
import fs from "fs";

const ITERATIONS = 1;

const benchmarks = [
    {
        name: "TRIPLE_HELIX",
        formula: LiRNA_TRIPLE_HELIX,
        vars: new Set(["l1", "l2", "l3"])
    },
    {
        name: "NOT_PAIRED",
        formula: LiRNA_NOT_PAIRED,
        vars: new Set<string>()
    },
    {
        name: "HAIRPIN",
        formula: LiRNA_HAIRPIN,
        vars: new Set<string>("l")
    },
    {
        name: "PSEUDOKNOT",
        formula: LiRNA_PSEUDOKNOT,
        vars: new Set(["l1", "l2"])
    }
];

benchmarks.reverse();

describe("Benchmark", () => {

    it("Run benchmark", async () => {

        const rows: string[] = [];

        rows.push(
            [
                "formula",
                "formula_length",
                "molecule",
                "length",
                "bonds",
                "buildSat_ms",
                "justOne_ms",
                "readable_ms",
                "total_ms",
                "solutions",
                "Sat"
            ].join(",")
        );

        for (const bench of benchmarks) {

            console.log(`\n=== ${bench.name} ===`);

            for (const molecule of molecules) {

                let buildTotal = 0;
                let justOneTotal = 0;
                let readableTotal = 0;
                let solutions = 0;
                let satisfied = false;

                for (let i = 0; i < ITERATIONS; i++) {

                    const t0 = performance.now();

                    const ctx = buildSatContext(
                        molecule.structure,
                        molecule.bonds
                    );

                    const satSet = sat(ctx, bench.formula);

                    const t1 = performance.now();

                    const one = await justOne(
                        satSet,
                        bench.vars,
                        molecule.bonds.length
                    );

                    const t2 = performance.now();

                    const readable = await toReadableSatSet(
                        satSet,
                        bench.vars,
                        molecule.bonds.length
                    );

                    const t3 = performance.now();

                    buildTotal += t1 - t0;
                    justOneTotal += t2 - t1;
                    readableTotal += t3 - t2;

                    solutions = readable.filter(r => r.satisfied).length;
                    if (i === 0) {
                        fs.writeFileSync(`${bench.name}_${molecule.name}_output.json`, JSON.stringify(readable, null, 2));
                    }
                    satisfied = readable[0]?.satisfied || false;
                }

                const buildAvg = buildTotal / ITERATIONS;
                const justAvg = justOneTotal / ITERATIONS;
                const readAvg = readableTotal / ITERATIONS;
                const total = buildAvg + readAvg;

                rows.push([
                    bench.name,
                    computeFormulaLength(bench.formula),
                    molecule.name,
                    molecule.structure.length,
                    molecule.bonds.length,
                    buildAvg.toFixed(3),
                    justAvg.toFixed(3),
                    readAvg.toFixed(3),
                    total.toFixed(3),
                    solutions,
                    satisfied
                ].join(","));

                console.log(
                    `${bench.name.padEnd(15)} ${molecule.name.padEnd(8)} total=${total.toFixed(2)} ms`
                );
            }
        }

        fs.writeFileSync("benchmark.csv", rows.join("\n"));

    });

});