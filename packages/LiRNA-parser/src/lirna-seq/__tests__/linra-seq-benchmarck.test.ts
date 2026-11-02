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
((<>l2>) && !(<> l2<)) @ l1
`

const HAIRPIN = `
(((( <>[] . )))) @ l 
`
const R = `('A' | 'G')`;

const M = `('C' | 'A')`;

const E_LOOP = `
(
    (
         ( 'A' && . && O('G' && . && O('U' && . && O('A' && .))) )
          | ( . && O('A' && . && O('G' && . && O('U' && . && O('A' && .)))))
    ) @ l1
)
    && <> ((${R} && . 
        && O ('A' && . 
            && O(${M} && . 
                && (O( 
                    (l1< | .  && O (l1<) )
                ))))))

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

const LiRNA_E_LOOP = parseFormula(E_LOOP);

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
        bonds: [[0, 64], [1, 63], [2, 62], [3, 61], [4, 60], [15, 46], [16, 45], [17, 44], [18, 43], [19, 42], [20, 41], [21, 40], [22, 39], [23, 38], [24, 37], [25, 36], [26, 35], [27, 34], [47, 92], [48, 91], [49, 90], [50, 89], [51, 88], [52, 87], [53, 86], [54, 85], [55, 84], [56, 83], [57, 82]]
    },
    {
        name: "PAN1",
        structure: "GCUGGGUUUUUCCUUCGAAAGAAGGUUUUUAUCCCAGUGUAUAAAAAAAAAAAAAAA",
        bonds: [[0, 37], [1, 36], [2, 35], [3, 34], [4, 33], [5, 32], [11, 24], [12, 23], [13, 22], [14, 21], [15, 20], [25, 56], [26, 55], [27, 54], [28, 53], [29, 52]]
    },
    {
        name: "PAN2",
        structure: "GGGUUUUUCCUUCGAAAGAAGGUUUUUAUCCCUGCCUUCGGGCAAAAAAAAA",
        bonds: [[0, 31], [1, 30], [2, 29], [8, 21], [9, 20], [10, 19], [11, 18], [12, 17], [22, 51], [23, 50], [24, 49], [25, 48], [26, 47], [32, 43], [33, 42], [34, 41], [35, 40]]
    },
    {
        name: "2M8K",
        structure: "GGUUUCUUUUUAGUGAUUUUUCCAAACCCCUUUGUGCAAAAAUCAUUA",
        bonds: [[0, 27], [1, 26], [2, 25], [3, 24], [4, 23], [11, 46], [12, 45], [13, 44], [14, 43], [15, 42], [16, 41], [17, 40], [18, 39], [19, 38], [20, 37], [22, 35]]
    },
    {
        name: "2K95",
        structure: "GGGCUGUUUUUCUCGCUGACUUUCAGCCCCAAACAAAAAAUGUCAGCA",
        bonds: [[0, 28], [1, 27], [2, 26], [3, 25], [4, 24], [5, 23], [14, 46], [15, 45], [16, 44], [17, 43], [18, 42], [19, 41], [20, 39], [21, 38], [22, 37]]
    },
    {
        name: "1YMO",
        structure: "GGGCUGUUUUUCUCGCUGACUUUCAGCCCCAAACAAAAAAGUCAGCA",
        bonds: [[0, 28], [1, 27], [2, 26], [3, 25], [4, 24], [5, 23], [14, 45], [15, 44], [16, 43], [17, 42], [18, 41], [19, 40], [20, 39], [21, 38], [22, 37]]
    },
    {
        name: "HTER",
        structure: "GGCCAUUUUUUGUCUAACCCUAACUGAGAAGGGCGUAGGCGCCGUGCUUUUGCUCCCCGCGGGCUGUUUUUCUCGCUGACUUUCAGCCCGCGGAAAAGCCUCGGCCUGCCGCCUUCCACCGUUCAUUCUAGAGCAAACAAAAAAUGUCAGCAGCUGGCC",
        bonds: [[0, 158], [1, 157], [2, 156], [3, 155], [4, 154], [29, 114], [30, 113], [31, 112], [32, 111], [33, 110], [34, 109], [35, 107], [36, 106], [37, 105], [38, 104], [39, 103], [45, 98], [46, 97], [47, 96], [48, 95], [49, 94], [50, 93], [56, 92], [57, 91], [58, 90], [59, 89], [60, 88], [61, 87], [62, 86], [63, 85], [64, 84], [65, 83], [74, 150], [75, 149], [76, 148], [77, 147], [78, 146], [79, 145], [80, 143], [81, 142], [82, 141]]
    },
    {
        name: "Not_Paired",
        structure: "GGAAGGUUUUUCUUC".repeat(10), //len = 150
        bonds: []
    },
    // {
    //     name: "Coli16S_2",
    //     structure: "UGAAGAGUUUGAUCAUGGCUCAGAUUGAACGCUGGCGGCAGGCCUAACACAUGCAAGUCGAACGGUAACAGGAAGAAGCUUGCUUCUUUGCUGACGAGUGGCGGACGGGUGAGUAAUGUCUGGGAAACUGCCUGAUGGAGGGGGAUAACUACUGGAAACGGUAGCUAAUACCGCAUAACGUCGCAAGACCAAAGAGGGGGACCUUCGGGCCUCUUGCCAUCGGAUGUGCCCAGAUGGGAUUAGCUAGUAGGUGGGGUAACGGCUCACCUAGGCGACGAUCCCUAGCUGGUCUGAGAGGAUGACCAGCCACACUGGAACUGAGACACGGUCCAGACUCCUACGGGAGGCAGCAGUGGGGAAUAUUGCACAAUGGGCGCAAGCCUGAUGCAGCCAUGCCGCGUGUAUGAAGAAGGCCUUCGGGUUGUAAAGUACUUUCAGCGGGGAGGAAGGGAGUAAAGUUAAUACCUUUGCUCAUUGACGUUACCCGCAGAAGAAGCACCGGCUAACUCCGUGCCAGCAGCCGCGGUAAUACGGAGGGUGCAAGCGUUAAUCGGAAUUACUGGGCGUAAAGCGCACGCAGGCGGUUUGUUAAGUCAGAUGUGAAAUCCCCGGGCUCAACCUGGGAACUGCAUCUGAUACUGGCAAGCUUGAGUCUCGUAGAGGGGGGUAGAAUUCCAGGUGUAGCGGUGAAAUGCGUAGAGAUCUGGAGGAAUACCGGUGGCGAAGGCGGCCCCCUGGACGAAGACUGACGCUCAGGUGCGAAAGCGUGGGGAGCAAACAGGAUUAGAUACCCUGGUAGUCCACGCCGUAAACGAUGUCGACUUGGAGGUUGUGCCCUUGAGGCGUGGCUUCCGGAGCUAACGCGUUAAGUCGACCGCCUGGGGAGUACGGCCGCAAGGUUAAAACUCAAAUGAAUUGACGGGGGCCCGCACAAGCGGUGGAGCAUGUGGUUUAAUUCGAUGCAACGCGAAGAACCUUACCUGGUCUUGACAUCCACGGAAGUUUUCAGAGAUGAGAAUGUGCCUUCGGGAACCGUGAGACAGGUGCUGCAUGGCUGUCGUCAGCUCGUGUUGUGAAAUGUUGGGUUAAGUCCCGCAACGAGCGCAACCCUUAUCCUUUGUUGCCAGCGGUCCGGCCGGGAACUCAAAGGAGACUGCCAGUGAUAAACUGGAGGAAGGUGGGGAUGACGUCAAGUCAUCAUGGCCCUUACGACCAGGGCUACACACGUGCUACAAUGGCGCAUACAAAGAGAAGCGACCUCGCGAGAGCAAGCGGACCUCAUAAAGUGCGUCGUAGUCCGGAUUGGAGUCUGCAACUCGACUCCAUGAAGUCGGAAUCGCUAGUAAUCGUGGAUCAGAAUGCCACGGUGAAUACGUUCCCGGGCCUUGUACACACCGCCCGUCACACCAUGGGAGUGGGUUGCAAAAGAAGUAGGUAGCUUAACCUUCGGGAGGGCGCUUACCACUUUGUGAUUCAUGACUGGGGUGAAGUCGUAACAAGGUAACCGUAGGGGAACCUGCGGUUGGAUCA",
    //     bonds: [
    //         [4, 20], [5, 19], [6, 18], [7, 17], [10, 915], [11, 914], [12, 913], [13, 912], [14, 911], [22, 551], [23, 550], [24, 549], [25, 548], [27, 547], [28, 546], [29, 545], [30, 544], [31, 543], [34, 398], [35, 397], [36, 396], [37, 395], [38, 394], [39, 393], [40, 391], [41, 390], [42, 356], [47, 354], [48, 353], [49, 352], [51, 351], [52, 350], [53, 349], [56, 101], [57, 100], [58, 99], [61, 98], [62, 97], [63, 96], [64, 94], [65, 93], [68, 92], [69, 91], [70, 90], [71, 88], [72, 87], [73, 86], [74, 85], [75, 84], [76, 83], [77, 82], [78, 81], [107, 310], [108, 309], [109, 308], [110, 307], [117, 234], [118, 233], [119, 232], [120, 231], [121, 230], [122, 229], [123, 228], [124, 227], [126, 226], [127, 225], [128, 224], [131, 222], [132, 221], [133, 220], [134, 219], [135, 218], [136, 217], [137, 216], [138, 215], [139, 173], [141, 171], [142, 170], [143, 169], [148, 163], [149, 162], [150, 161], [151, 160], [152, 159], [153, 158], [179, 188], [180, 187], [181, 186], [193, 214], [194, 213], [195, 212], [196, 211], [197, 210], [198, 209], [201, 208], [202, 207], [235, 281], [236, 280], [237, 279], [239, 888], [240, 278], [242, 272], [243, 271], [244, 270], [247, 269], [248, 268], [249, 267], [250, 266], [251, 265], [252, 264], [253, 263], [254, 262], [284, 306], [285, 305], [286, 304], [287, 303], [288, 299], [289, 298], [290, 297], [291, 296], [311, 332], [312, 331], [313, 330], [314, 329], [315, 328], [316, 327], [333, 346], [334, 345], [335, 344], [336, 343], [337, 342], [362, 388], [364, 387], [365, 386], [366, 385], [370, 384], [371, 382], [372, 381], [373, 380], [374, 379], [401, 431], [402, 430], [403, 429], [404, 428], [410, 423], [411, 422], [412, 421], [413, 420], [414, 419], [435, 492], [437, 487], [438, 486], [439, 485], [440, 484], [441, 483], [445, 478], [449, 473], [450, 472], [451, 471], [452, 470], [453, 469], [454, 467], [455, 466], [457, 465], [468, 454], [474, 449], [495, 540], [496, 539], [497, 538], [498, 537], [499, 536], [500, 521], [501, 520], [502, 519], [506, 535], [507, 534], [508, 533], [509, 532], [510, 531], [516, 523], [517, 522], [562, 878], [563, 877], [564, 876], [565, 861], [566, 860], [570, 875], [572, 759], [573, 758], [574, 757], [575, 756], [579, 752], [580, 751], [581, 750], [583, 646], [584, 645], [585, 644], [586, 643], [587, 642], [588, 641], [589, 640], [591, 639], [592, 638], [593, 635], [594, 634], [595, 633], [596, 632], [597, 631], [598, 630], [599, 629], [600, 628], [606, 624], [607, 623], [608, 622], [609, 621], [610, 620], [611, 619], [612, 618], [649, 749], [650, 746], [651, 745], [652, 744], [653, 743], [654, 741], [655, 740], [656, 739], [657, 738], [658, 737], [659, 736], [661, 735], [662, 734], [663, 733], [664, 732], [665, 731], [666, 730], [667, 729], [668, 712], [669, 711], [670, 710], [671, 709], [672, 708], [673, 707], [674, 706], [675, 705], [676, 704], [677, 703], [678, 702], [679, 701], [683, 694], [684, 693], [720, 727], [721, 726], [763, 806], [764, 805], [765, 804], [766, 803], [767, 802], [768, 801], [769, 800], [773, 799], [774, 798], [778, 794], [779, 793], [780, 792], [781, 791], [812, 1524], [816, 874], [817, 873], [818, 872], [819, 871], [820, 870], [821, 869], [824, 852], [825, 851], [826, 850], [827, 849], [828, 848], [829, 847], [830, 846], [831, 845], [832, 844], [833, 843], [834, 842], [835, 841], [856, 863], [857, 862], [880, 907], [881, 906], [882, 905], [889, 900], [890, 899], [891, 898], [892, 897], [916, 1391], [917, 1390], [918, 1388], [919, 1387], [920, 1386], [922, 1385], [923, 1384], [924, 1383], [925, 1382], [926, 1381], [927, 1380], [928, 1379], [930, 1375], [931, 1374], [933, 1340], [934, 1339], [935, 1338], [936, 1337], [937, 1336], [938, 1335], [940, 1231], [941, 1230], [942, 1229], [943, 1228], [944, 1227], [945, 1226], [946, 1225], [947, 1224], [948, 1223], [949, 1221], [950, 1220]
    //     ]
    // },
    // {
    //     name: "EColi23S_bee",
    //     structure: "GGUUAAGCGACUAAGCGUACACGGUGGAUGCCCUGGCAGUCAGAGGCGAGUAAUGAAGGACGUGCUAAUCUGCGAUAAGCGUCGGUAAGGUGAUAUGAACCGUUAUAACCGGCGAUUUCCGAAUGGGGAAACCCAGUGUGUUUCGACACACUAUCAUUAACUGAAUCCAUAGGUUAAUGAGGCGAACCGGGGGAACUGAAACAUCUACCCCGAGGAAAAGAAAUCAACCGAGAUUCCCCCAGUAGCGGCGAGCGAACGGGGAGCAGCCCAGAGCCUGAAUCAGUGUGUGUGUUAGUGGAAGCGUCUGGAAAGGCGCGCGAUACAGGGUGACAGCCCCGUACACAAAAAUGCACAUGCUGUGAGCUCGAUGAGUAGGGCGGGACACGUGGUAUCCUGUCUGAAUAUGGGGGGACCAUCCUCCAAGGCUAAAUACUCCUGACUGACCGAUAGUGAACCAGUACCGUGAGGGAAAGGCGAAAAGAACCCCGGCGAGGGGAGUGAAAAAGAACCUGAAACCGUGUACGUACAAGCAGUGGGAGCACGCUUAGGCGUGUGACUGCGUACCUUUUGUAUAAUGGGUCAGCGACUUAUAUUCUGUAGCAAGGUUAACCGAAUAGGGGAGCCGAAGGGAAACCGAGUCUUAACUGGGCGUUAAGUUGCAGGGUAUAGACCCGAAACCCGGUGAUCUAGCCAUGGGCAGGUUGAAGGUUGGGUAACACUAACUGGAGGACCGAACCGACUAAUGUUGAAAAAUUAGCGGAUGACUUGUGGCUGGGGGUGAAAGGCCAAUCAAACCGGGAGAUAGCUGGUUCUCCCCGAAAGCUAUUUAGGUAGCGCCUCGUGAAUUCAUCUCCGGGGGUAGAGCACUGUUUCGGCAAGGGGGUCAUCCCGACUUACCAACCCGAUGCAAACUGCGAAUACCGGAGAAUGUUAUCACGGGAGACACACGGCGGGUGCUAACGUCCGUCGUGAAGAGGGAAACAACCCAGACCGCCAGCUAAGGUCCCAAAGUCAUGGUUAAGUGGGAAACGAUGUGGGAAGGCCCAGACAGCCAGGAUGUUGGCUUAGAAGCAGCCAUCAUUUAAAGAAAGCGUAAUAGCUCACUGGUCGAGUCGGCCUGCGCGGAAGAUGUAACGGGGCUAAACCAUGCACCGAAGCUGCGGCAGCGACGCUUAUGCGUUGUUGGGUAGGGGAGCGUUCUGUAAGCCUGCGAAGGUGUGCUGUGAGGCAUGCUGGAGGUAUCAGAAGUGCGAAUGCUGACAUAAGUAACGAUAAAGCGGGUGAAAAGCCCGCUCGCCGGAAGACCAAGGGUUCCUGUCCAACGUUAAUCGGGGCAGGGUGAGUCGACCCCUAAGGCGAGGCCGAAAGGCGUAGUCGAUGGGAAACAGGUUAAUAUUCCUGUACUUGGUGUUACUGCGAAGGGGGGACGGAGAAGGCUAUGUUGGCCGGGCGACGGUUGUCCCGGUUUAAGCGUGUAGGCUGGUUUUCCAGGCAAAUCCGGAAAAUCAAGGCUGAGGCGUGAUGACGAGGCACUACGGUGCUGAAGCAACAAAUGCCCUGCUUCCAGGAAAAGCCUCUAAGCAUCAGGUAACAUCAAAUCGUACCCCAAACCGACACAGGUGGUCAGGUAGAGAAUACCAAGGCGCUUGAGAGAACUCGGGUGAAGGAACUAGGCAAAAUGGUGCCGUAACUUCGGGAGAAGGCACGCUGAUAUGUAGGUGAGGUCCCUCGCGGAUGGAGCUGAAAUCAGUCGAAGAUACCAGCUGGCUGCAACUGUUUAUUAAAAACACAGCACUGUGCAAACACGAAAGUGGACGUAUACGGUGUGACGCCUGCCCGGUGCCGGAAGGUUAAUUGAUGGGGUUAGCGCAAGCGAAGCUCUUGAUCGAAGCCCCGGUAAACGGCGGCCGUAACUAUAACGGUCCUAAGGUAGCGAAAUUCCUUGUCGGGUAAGUUCCGACCUGCACGAAUGGCGUAAUGAUGGCCAGGCUGUCUCCACCCGAGACUCAGUGAAAUUGAACUCGCUGUGAAGAUGCAGUGUACCCGCGGCAAGACGGAAAGACCCCGUGAACCUUUACUAUAGCUUGACACUGAACAUUGAGCCUUGAUGUGUAGGAUAGGUGGGAGGCUUUGAAGUGUGGACGCCAGUCUGCAUGGAGCCGACCUUGAAAUACCACCCUUUAAUGUUUGAUGUUCUAACGUUGACCCGUAAUCCGGGUUGCGGACAGUGUCUGGUGGGUAGUUUGACUGGGGCGGUCUCCUCCUAAAGAGUAACGGAGGAGCACGAAGGUUGGCUAAUCCUGGUCGGACAUCAGGAGGUUAGUGCAAUGGCAUAAGCCAGCUUGACUGCGAGCGUGACGGCGCGAGCAGGUGCGAAAGCAGGUCAUAGUGAUCCGGUGGUUCUGAAUGGAAGGGCCAUCGCUCAACGGAUAAAAGGUACUCCGGGGAUAACAGGCUGAUACCGCCCAAGAGUUCAUAUCGACGGCGGUGUUUGGCACCUCGAUGUCGGCUCAUCACAUCCUGGGGCUGAAGUAGGUCCCAAGGGUAUGGCUGUUCGCCAUUUAAAGUGGUACGCGAGCUGGGUUUAGAACGUCGUGAGACAGUUCGGUCCCUAUCUGCCGUGGGCGCUGGAGAACUGAGGGGGGCUGCUCCUAGUACGAGAGGAAACGAGUGGACGCAUCACUGGUGUUCGGGUUGUCAUGCCAAUGGCACUGCCCGGUAGCUAAAUGCGGAAGAGAUAAGUGCUGAAAGCAUCUAAGCACGAAACUUGCCCCGAGAUGAGUUCUCCCUGACCCUUUAAGGGUCCUGAAGGAACGUUGAAGACGACGACGUUGAUAGGCCGGGUGUGUAAGCGCAGCGAUGCGUUGAGCUAACCGGUACUAAUGAACCGUGAGGCUUAACCUU",
    //     bonds: [[0, 2902], [1, 2901], [2, 2900], [3, 2899], [4, 2898], [5, 2897], [6, 2896], [7, 2895], [14, 525], [15, 524], [16, 523], [17, 522], [18, 521], [19, 520], [20, 519], [21, 518], [22, 517], [23, 516], [29, 510], [30, 474], [31, 473], [34, 444], [35, 443], [36, 441], [37, 440], [38, 439], [39, 438], [40, 437], [41, 436], [42, 435], [43, 433], [44, 432], [45, 178], [46, 177], [53, 115], [54, 114], [55, 113], [56, 69], [57, 68], [58, 67], [60, 92], [63, 89], [64, 88], [65, 87], [75, 109], [76, 108], [77, 107], [78, 106], [79, 105], [80, 104], [84, 96], [85, 95], [86, 94], [120, 129], [121, 128], [122, 127], [130, 147], [131, 146], [132, 145], [133, 144], [134, 143], [135, 142], [136, 141], [149, 175], [150, 174], [151, 173], [152, 172], [153, 171], [154, 170], [155, 169], [156, 168], [157, 167], [182, 213], [183, 211], [184, 210], [185, 209], [186, 208], [187, 207], [193, 200], [197, 247], [223, 230], [224, 229], [234, 261], [235, 260], [236, 259], [237, 258], [238, 257], [244, 252], [245, 251], [265, 425], [266, 424], [267, 423], [268, 369], [270, 365], [271, 364], [272, 363], [273, 362], [280, 358], [281, 357], [282, 356], [283, 355], [284, 354], [285, 353], [286, 352], [287, 351], [288, 350], [289, 349], [290, 348], [291, 347], [292, 346], [294, 342], [295, 341], [296, 340], [300, 315], [301, 314], [302, 313], [303, 312], [304, 311], [316, 333], [317, 332], [318, 322], [324, 336], [325, 335], [326, 334], [374, 398], [375, 397], [376, 396], [377, 395], [378, 394], [379, 393], [380, 392], [381, 391], [384, 410], [405, 420], [406, 419], [407, 418], [408, 417], [409, 416], [412, 2410], [413, 2409], [414, 2408], [415, 2407], [455, 472], [461, 468], [462, 467], [481, 509], [484, 496], [485, 495], [486, 494], [487, 493], [531, 2018], [533, 560], [534, 559], [535, 558], [536, 557], [539, 554], [540, 553], [541, 552], [542, 551], [543, 550], [562, 2033], [564, 577], [566, 575], [579, 1261], [580, 1260], [581, 1259], [582, 1258], [583, 1257], [584, 1256], [589, 668], [590, 667], [591, 666], [592, 665], [593, 664], [594, 663], [595, 662], [596, 661], [597, 660], [598, 659], [599, 658], [600, 657], [601, 656], [604, 624], [605, 623], [606, 622], [610, 618], [611, 617], [628, 635], [629, 634], [638, 650], [639, 649], [640, 648], [641, 647], [671, 809], [672, 808], [674, 806], [678, 799], [679, 798], [680, 797], [681, 796], [682, 795], [683, 794], [689, 773], [690, 772], [691, 771], [692, 770], [693, 769], [694, 768], [695, 767], [696, 766], [697, 765], [698, 763], [700, 732], [701, 731], [702, 730], [703, 728], [707, 724], [708, 723], [709, 722], [710, 721], [711, 720], [712, 719], [729, 1774], [736, 760], [737, 759], [738, 758], [740, 757], [741, 756], [742, 755], [743, 754], [744, 753], [775, 791], [777, 787], [778, 786], [779, 785], [812, 1195], [813, 1194], [814, 1193], [815, 1192], [816, 1191], [817, 1190], [822, 835], [823, 834], [824, 833], [825, 832], [826, 831], [837, 942], [838, 940], [839, 939], [840, 938], [841, 937], [842, 936], [843, 935], [844, 934], [848, 930], [849, 929], [850, 928], [851, 926], [852, 925], [853, 924], [854, 923], [855, 922], [856, 921], [858, 919], [862, 915], [863, 913], [864, 912], [868, 909], [869, 908], [870, 907], [872, 905], [873, 904], [874, 903], [875, 902], [946, 971], [947, 970], [948, 969], [949, 968], [950, 967], [951, 966], [952, 965], [953, 964], [954, 963], [955, 962], [976, 987], [977, 986], [978, 985], [991, 1163], [992, 1162], [993, 1161], [994, 1160], [996, 1159], [997, 1158], [998, 1157], [1002, 1153], [1003, 1152], [1004, 1151], [1005, 1138], [1006, 1137], [1007, 1136], [1011, 1150], [1013, 1149], [1014, 1148], [1015, 1147], [1016, 1146], [1017, 1145], [1018, 1144], [1024, 1140], [1030, 1124], [1031, 1123], [1034, 1121], [1035, 1120], [1036, 1119], [1037, 1118], [1038, 1117], [1041, 1114], [1042, 1113], [1043, 1112], [1049, 2751], [1051, 1108], [1052, 1107], [1053, 1106], [1054, 1105], [1055, 1104], [1057, 1081], [1058, 1080], [1059, 1079], [1062, 1076], [1063, 1075], [1064, 1074], [1087, 1102], [1090, 1101], [1091, 1100], [1092, 1099], [1164, 1185], [1165, 1184], [1166, 1183], [1167, 1182], [1168, 1181], [1169, 1180], [1170, 1179], [1171, 1178], [1172, 1177], [1196, 1250], [1198, 1247], [1199, 1246], [1200, 1245], [1201, 1244], [1202, 1243], [1206, 1240], [1207, 1239], [1208, 1238], [1215, 1234], [1216, 1233], [1217, 1232], [1218, 1231], [1219, 1230], [1220, 1229], [1221, 1228], [1222, 1227], [1262, 2017], [1269, 2011], [1270, 2010], [1276, 1294], [1277, 1293], [1278, 1292], [1279, 1291], [1280, 1290], [1281, 1289], [1295, 1645], [1296, 1644], [1297, 1643], [1298, 1642], [1303, 1625], [1304, 1624], [1305, 1623], [1306, 1622], [1309, 1605], [1310, 1604], [1313, 1603], [1314, 1338], [1315, 1337], [1316, 1336], [1317, 1335], [1318, 1334], [1319, 1333], [1323, 1331], [1324, 1330], [1343, 1404], [1344, 1403], [1345, 1601], [1346, 1600], [1347, 1599], [1350, 1381], [1351, 1380], [1355, 1376], [1356, 1375], [1357, 1374], [1361, 1370], [1362, 1369], [1363, 1368], [1385, 1402], [1386, 1401], [1387, 1400], [1388, 1399], [1389, 1398], [1405, 1597], [1406, 1596], [1407, 1595], [1408, 1594], [1409, 1593], [1410, 1592], [1411, 1591], [1412, 1590], [1413, 1589], [1414, 1588], [1416, 1582], [1417, 1581], [1421, 1577], [1422, 1576], [1423, 1575], [1424, 1574], [1429, 1564], [1430, 1563], [1431, 1562], [1432, 1561], [1435, 1557], [1436, 1556], [1437, 1555], [1440, 1551], [1441, 1550], [1442, 1549], [1443, 1548], [1444, 1547], [1445, 1466], [1446, 1465], [1447, 1464], [1448, 1463], [1449, 1462], [1455, 2704], [1456, 2703], [1457, 2702], [1467, 1525], [1468, 1524], [1471, 1520], [1472, 1519], [1473, 1518], [1474, 1517], [1478, 1513], [1479, 1512], [1480, 1511], [1481, 1510], [1482, 1507], [1483, 1506], [1484, 1505], [1485, 1504], [1486, 1503], [1487, 1502], [1488, 1501], [1489, 1500], [1491, 1499], [1492, 1498], [1516, 1732], [1526, 1546], [1529, 1542], [1530, 1541], [1531, 1540], [1532, 1539], [1533, 1538], [1565, 1568], [1611, 1620], [1612, 1619], [1627, 1639], [1628, 1638], [1629, 1637], [1630, 1636], [1648, 2009], [1649, 2008], [1650, 2007], [1651, 2006], [1656, 2004], [1657, 2003], [1658, 2002], [1659, 2001], [1660, 2000], [1661, 1999], [1662, 1998], [1663, 1997], [1665, 1995], [1666, 1994], [1669, 1993], [1674, 1990], [1682, 1706], [1683, 1705], [1684, 1704], [1685, 1703], [1686, 1702], [1691, 1696], [1693, 1829], [1707, 1751], [1708, 1750], [1709, 1749], [1710, 1748], [1711, 1747], [1712, 1746], [1718, 1742], [1719, 1741], [1720, 1740], [1724, 1736], [1725, 1735], [1726, 1734], [1727, 1733], [1728, 1731], [1752, 1756], [1764, 1988], [1765, 1987], [1766, 1986], [1767, 1985], [1768, 1984], [1769, 1983], [1770, 1982], [1771, 1980], [1772, 1979], [1776, 1788], [1777, 1787], [1792, 1827], [1793, 1826], [1794, 1825], [1795, 1824], [1796, 1823], [1797, 1822], [1798, 1821], [1804, 1813], [1805, 1812], [1806, 1811], [1830, 1975], [1831, 1974], [1832, 1973], [1833, 1972], [1835, 1905], [1836, 1904], [1837, 1903], [1840, 1902], [1841, 1901], [1842, 1898], [1843, 1897], [1844, 1896], [1845, 1895], [1846, 1894], [1849, 1893], [1850, 1892], [1851, 1891], [1860, 1882], [1861, 1881], [1862, 1880], [1863, 1879], [1864, 1878], [1867, 1874], [1868, 1873], [1906, 1924], [1907, 1923], [1908, 1922], [1909, 1921], [1910, 1920], [1933, 1967], [1934, 1964], [1945, 1961], [1946, 1960], [1947, 1959], [1948, 1958], [1949, 1957], [2020, 2034], [2023, 2040], [2024, 2039], [2025, 2038], [2026, 2037], [2027, 2036], [2043, 2625], [2044, 2624], [2045, 2623], [2046, 2622], [2047, 2621], [2048, 2620], [2049, 2619], [2050, 2618], [2052, 2617], [2053, 2616], [2054, 2615], [2056, 2612], [2057, 2611], [2064, 2446], [2065, 2445], [2066, 2444], [2067, 2443], [2069, 2442], [2070, 2441], [2071, 2438], [2072, 2437], [2073, 2436], [2074, 2435], [2077, 2243], [2078, 2242], [2079, 2241], [2080, 2240], [2081, 2239], [2083, 2236], [2084, 2235], [2085, 2234], [2087, 2232], [2088, 2231], [2089, 2230], [2090, 2229], [2091, 2228], [2093, 2196], [2094, 2195], [2095, 2194], [2096, 2193], [2097, 2192], [2098, 2191], [2099, 2190], [2100, 2189], [2101, 2188], [2102, 2187], [2103, 2186], [2105, 2184], [2106, 2183], [2107, 2182], [2108, 2181], [2110, 2179], [2136, 2155], [2137, 2154], [2138, 2153], [2139, 2152], [2140, 2151], [2141, 2150], [2142, 2149], [2200, 2223], [2201, 2222], [2202, 2221], [2204, 2220], [2205, 2219], [2206, 2218], [2207, 2217], [2208, 2216], [2209, 2215], [2246, 2258], [2247, 2257], [2248, 2256], [2255, 2275], [2259, 2281], [2260, 2280], [2261, 2279], [2262, 2278], [2263, 2277], [2264, 2276], [2267, 2272], [2282, 2427], [2283, 2325], [2284, 2384], [2285, 2383], [2289, 2343], [2290, 2342], [2291, 2341], [2292, 2340], [2293, 2339], [2294, 2338], [2295, 2337], [2299, 2317], [2300, 2316], [2301, 2315], [2302, 2314], [2303, 2313], [2304, 2312], [2323, 2332], [2324, 2331], [2326, 2389], [2328, 2387], [2329, 2386], [2330, 2385], [2347, 2370], [2348, 2369], [2349, 2368], [2350, 2367], [2353, 2364], [2354, 2363], [2355, 2362], [2356, 2361], [2359, 2428], [2372, 2381], [2373, 2380], [2374, 2379], [2395, 2421], [2396, 2420], [2397, 2419], [2398, 2418], [2399, 2417], [2400, 2416], [2401, 2415], [2403, 2414], [2404, 2413], [2453, 2500], [2454, 2498], [2455, 2496], [2456, 2495], [2457, 2494], [2459, 2493], [2461, 2489], [2462, 2488], [2463, 2487], [2464, 2486], [2465, 2485], [2466, 2484], [2470, 2480], [2471, 2479], [2506, 2583], [2507, 2582], [2508, 2580], [2509, 2579], [2510, 2578], [2512, 2574], [2513, 2571], [2514, 2570], [2515, 2569], [2516, 2568], [2517, 2567], [2520, 2545], [2521, 2544], [2522, 2543], [2523, 2540], [2524, 2539], [2525, 2538], [2526, 2537], [2527, 2536], [2528, 2535], [2547, 2561], [2548, 2560], [2549, 2559], [2550, 2558], [2551, 2557], [2588, 2606], [2589, 2605], [2590, 2604], [2591, 2603], [2592, 2601], [2593, 2600], [2594, 2599], [2626, 2777], [2630, 2788], [2631, 2787], [2632, 2786], [2633, 2785], [2634, 2784], [2635, 2783], [2636, 2782], [2640, 2774], [2641, 2773], [2642, 2772], [2643, 2771], [2646, 2674], [2647, 2673], [2648, 2672], [2649, 2671], [2650, 2670], [2651, 2669], [2652, 2668], [2658, 2663], [2676, 2731], [2677, 2730], [2678, 2729], [2679, 2728], [2680, 2727], [2684, 2725], [2685, 2724], [2686, 2723], [2687, 2722], [2691, 2718], [2692, 2717], [2693, 2716], [2694, 2715], [2695, 2714], [2696, 2711], [2697, 2710], [2698, 2709], [2699, 2708], [2700, 2707], [2701, 2706], [2735, 2769], [2736, 2768], [2737, 2767], [2742, 2762], [2743, 2761], [2744, 2760], [2745, 2759], [2789, 2894], [2791, 2805], [2792, 2804], [2793, 2803], [2794, 2802], [2795, 2801], [2796, 2800], [2806, 2892], [2811, 2889], [2812, 2888], [2815, 2831], [2816, 2830], [2817, 2829], [2818, 2828], [2819, 2827], [2836, 2882], [2837, 2881], [2838, 2880], [2839, 2878], [2840, 2877], [2841, 2876], [2842, 2875], [2843, 2874], [2846, 2870], [2847, 2869], [2852, 2865], [2853, 2864], [2854, 2863], [2855, 2862], [2856, 2861]]
    // }
]; // Reverse per avere le molecole più piccole prima, utile per il benchmark
molecules.reverse();
console.log("23S: ", molecules[0].structure.substring(455, 472));
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
    },
    {
        name: "E_LOOP",
        formula: LiRNA_E_LOOP,
        vars: new Set(["l1"]),
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