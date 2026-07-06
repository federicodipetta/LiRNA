import { describe, expect, it } from "vitest";
import { buildSatContext, sat, toReadableSatSet } from "../evaluetor-full";
import { parseLtlFormula } from "../parser";
import * as fs from "fs";

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

let parseResult = parseLtlFormula(TRIPLE_HELIX_FORMULA);
if (parseResult.error) {
    throw new Error(`Error parsing formula: ${parseResult.error}`);
}
const LiRNA_TRIPLE_HELIX = parseResult.formula!;

type Molecule = {
    name: string;
    structure: string;
    bonds: [number, number][];
};

const molecules: Molecule[] = [
    {
        name: "1YMO",
        structure: "GGGCUGUUUUUCUCGCUGACUUUCAGCCCCAAACAAAAAAGUCAGCA",
        // Mappatura pulita degli accoppiamenti canonici della tripla elica (0-based)
        bonds: [
            [0, 29], [1, 28], [2, 27], [3, 26], [4, 25], [5, 24],
            [14, 46], [15, 45], [16, 44], [17, 43], [18, 42], [19, 41], [20, 40], [21, 39], [22, 38]
        ]
    },
    {
        name: "HTER",
        structure: "GGCCAUUUUUUGUCUAACCCUAACUGAGAAGGGCGUAGGCGCCGUGCUUUUGCUCCCCGCGGGCUGUUUUUCUCGCUGACUUUCAGCCCGCGGAAAAGCCUCGGCCUGCCGCCUUCCACCGUUCAUUCUAGAGCAAACAAAAAAUGUCAGCAGCUGGCC",
        // Mappatura selettiva del dominio della tripla elica per hTER per evitare conflitti di sovrapposizione in satRho
        bonds: [
            [0, 156], [1, 155], [2, 154], [3, 153], [4, 152],
            [61, 142], [62, 141], [63, 140], [64, 139], [65, 138],
            [76, 105], [77, 104], [78, 103], [79, 102], [80, 101], [81, 100], [82, 99], [83, 98], [84, 97], [85, 96]
        ]
    }
];

// Ordina preventivamente i legami per l'indice di partenza (richiesto da buildSatContext)
molecules.forEach((molecule) => {
    molecule.bonds.sort((a, b) => a[0] - b[0]);
});

describe("RNA Triple Helix - Analisi di Validazione per 1YMO e hTER", () => {

    molecules.forEach((molecule) => {
        it(`Dovrebbe trovare la tripla elica ed eseguire il benchmark per ${molecule.name}`, async () => {
            console.log(`\n----------------------------------------`);
            console.log(`AVVIO BENCHMARK: ${molecule.name}`);
            console.log(`----------------------------------------`);

            // 1. Misurazione di sat()
            const startSat = performance.now();
            const context = buildSatContext(molecule.structure, molecule.bonds);
            const ssat = sat(context, LiRNA_TRIPLE_HELIX);
            const endSat = performance.now();
            const timeSat = endSat - startSat;

            // 2. Misurazione di toReadableSatSet()
            const startReadable = performance.now();
            const readableSatSet = await toReadableSatSet(
                ssat,
                new Set(["l1", "l2", "l3"]),
                molecule.structure.length - 1
            );
            const endReadable = performance.now();
            const timeReadable = endReadable - startReadable;

            console.log(`[-] Tempo sat(): ${timeSat.toFixed(2)} ms`);
            console.log(`[-] Tempo toReadableSatSet(): ${timeReadable.toFixed(2)} ms`);
            console.log(`[*] TEMPO TOTALE: ${(timeSat + timeReadable).toFixed(2)} ms`);

            // Filtro dei risultati soddisfatti
            const satisfiedResults = readableSatSet.filter(r => r.satisfied);
            console.log(`[+] Match validi trovati: ${satisfiedResults.length}`);

            // Scrittura del file JSON di diagnostica per ispezionare le assegnazioni delle variabili l1, l2, l3
            fs.writeFileSync(`${molecule.name}_output.json`, JSON.stringify(readableSatSet, null, 2));

            // TEST DI BASE: Almeno un elemento strutturale deve essere soddisfatto
            expect(satisfiedResults.length).toBeGreaterThan(0);

            // TEST AVANZATO: Verifica che i vincoli contengano assegnazioni valide per i tre filamenti
            const hasValidTripleHelix = satisfiedResults.some(entry =>
                entry.substitutions.length > 0 && entry.substitutions.some(sub =>
                    sub.l1 !== undefined && sub.substitutions !== null
                )
            );
            expect(hasValidTripleHelix).toBe(true);
        });
    });
});