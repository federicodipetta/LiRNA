import { AtomicRho, LiRNAFormula as Formula } from "./ast";
import { Constraint, TRUE, FALSE, eq, Z3Wrapper, Solver, Int, Or, substitute, Z3, And } from "./z3Wrapper";

export type BasePair = {
    id: string;
    start: number;
    end: number;
}

export type SatContext = {
    bonsFromStart: BasePair[];
    bonsFromEnd: BasePair[];
    sequence: string;
    /**
     * The length of the sequence, is equal to @code{@link sequence}.length - 1 to use for 1-based indexing.
     */
    sequenceLength: number;
    sequenceStart: number;

}

export type TimeRange = {
    start: number;
    end: number;
}

export type SatEntry = {
    constraint: Constraint;
    timeRange: TimeRange;
}

export type SatSet = SatEntry[];

export function buildSatContextFromBasePairs(sequence: string, pairs: BasePair[]): SatContext {
    return {
        bonsFromStart: pairs,
        bonsFromEnd: [...pairs].sort((a, b) => a.end - b.end || a.start - b.start || Number(a.id) - Number(b.id)),
        sequence: sequence,
        sequenceLength: sequence.length - 1,
        sequenceStart: 0,
    };
}

export function buildSatContextFromBasePairsWithStartIndex(sequence: string, pairs: BasePair[], startIndex: number): SatContext {
    let context = buildSatContextFromBasePairs(sequence, pairs);
    context.sequenceStart = startIndex;
    return context;
}


export function buildSatContext(
    sequence: string,
    pairs: ReadonlyArray<readonly [number, number]>,
): SatContext {
    const arcs = pairs.map(([left, right], index) => ({
        id: String(index + 1),
        start: Math.min(left, right),
        end: Math.max(left, right),
    }));

    const byStart = [...arcs].sort((a, b) => a.start - b.start);
    const byEnd = [...arcs].sort((a, b) => a.end - b.end);

    return {
        sequence,
        sequenceLength: sequence.length - 1,
        sequenceStart: 0,
        bonsFromStart: byStart,
        bonsFromEnd: byEnd,
    };
}

/*
* UNARY OPERATORS 
*/

export function satTrue(context: SatContext): SatSet {
    return [{
        constraint: TRUE,
        timeRange: { start: context.sequenceStart, end: context.sequenceLength },
    }];
}

export function satFalse(context: SatContext): SatSet {
    return [{
        constraint: FALSE,
        timeRange: { start: context.sequenceStart, end: context.sequenceLength },
    }]
}

export function satAtom(context: SatContext, value: string): SatSet {
    const result: SatSet = [];
    let isTrue = context.sequence[context.sequenceStart] === value;
    let currentStart = context.sequenceStart;
    for (let t = context.sequenceStart; t <= context.sequenceLength; t += 1) {
        if (isTrue === false && context.sequence[t] === value) {
            isTrue = true;
            result.push({
                constraint: FALSE,
                timeRange: { start: currentStart, end: t - 1 },
            });
            currentStart = t;
        } else if (isTrue === true && context.sequence[t] !== value) {
            isTrue = false;
            result.push({
                constraint: TRUE,
                timeRange: { start: currentStart, end: t - 1 },
            });
            currentStart = t;
        }
    }
    if (currentStart <= context.sequenceLength) {
        result.push({
            constraint: isTrue ? TRUE : FALSE,
            timeRange: { start: currentStart, end: context.sequenceLength },
        });
    }
    return result;
}

export function satNext(set: SatSet): SatSet {

    return set.map((entry) => {
        entry.timeRange = {
            start: Math.max(entry.timeRange.start - 1, 0),
            end: entry.timeRange.end - 1,
        }
        return entry;
    })
        // Remove the entry corresponding to time 0, as it does not have a predecessor.
        .filter((entry) => entry.timeRange.end >= 0);
}

export function satNot(set: SatSet): SatSet {
    return set.map((entry) => ({
        timeRange: entry.timeRange,
        constraint: entry.constraint === TRUE
            ? FALSE
            : entry.constraint === FALSE
                ? TRUE
                : entry.constraint.not()
    }));
}

export function satRho(context: SatContext, rho: AtomicRho): SatSet {
    const entries: SatSet = [];
    const orderedBonds = rho.kind === "up" 
        ? context.bonsFromStart.filter(bond => bond.start >= context.sequenceStart && bond.start <= context.sequenceLength)
        : context.bonsFromEnd.filter(bond => bond.end >= context.sequenceStart && bond.end <= context.sequenceLength);
    let lastPosition = context.sequenceStart;
    if (orderedBonds.length === 0) {
        entries.push({
            timeRange: { start: context.sequenceStart, end: context.sequenceLength },
            constraint: FALSE,
        });
    }
    for (const currentBond of orderedBonds) {
        const postiion = rho.kind === "up" ? currentBond.start : currentBond.end;

        if (postiion < context.sequenceStart || postiion > context.sequenceLength) {
            continue;
        }

        if (postiion > lastPosition) {
            entries.push({
                timeRange: { start: lastPosition, end: postiion - 1 },
                constraint: FALSE,
            });
        }

        entries.push({
            timeRange: { start: postiion, end: postiion },
            constraint: eq(rho.label, Number(currentBond.id)),
        })

        lastPosition = postiion + 1;
    }

    if (entries.length > 0 && lastPosition <= context.sequenceLength) {
        entries.push({
            timeRange: { start: lastPosition, end: context.sequenceLength },
            constraint: FALSE,
        });
    }

    return entries;
}

export function satEventually(context: SatContext, set: SatSet): SatSet {
    let result = [];
    let constraint = FALSE;
    for (let i = set.length - 1; i >= 0; i -= 1) {
        constraint = constraint.or(set[i].constraint);
        result.push({
            timeRange: {
                start: set[i].timeRange.start,
                end: set[i].timeRange.end,
            },
            constraint: constraint,
        });
    }
    return result.reverse();
}

export function satAlways(context: SatContext, set: SatSet): SatSet {
    let result = [];
    let constraint = TRUE;
    for (let i = set.length - 1; i >= 0; i -= 1) {
        constraint = constraint.and(set[i].constraint);
        result.push({
            timeRange: {
                start: set[i].timeRange.start,
                end: set[i].timeRange.end,
            },
            constraint: constraint,
        });
    }
    return result.reverse();
}

/*
* BINARY OPERATORS
*/

export function satOr(context: SatContext, s1: SatSet, s2: SatSet): SatSet {
    const result: SatSet = [];
    [s1, s2] = AlignSatSets(s1, s2);
    for (let i = 0; i < s1.length; i += 1) {
        const entry1 = s1[i];
        const entry2 = s2[i];
        result.push({
            timeRange: { start: entry1.timeRange.start, end: entry1.timeRange.end },
            constraint: entry1.constraint.or(entry2.constraint),
        });
    }
    return result;
}

export function satUntil(context: SatContext, s1: SatSet, s2: SatSet): SatSet {
    [s1, s2] = AlignSatSets(s1, s2);
    let result: SatSet = [];
    let nextConstraint = FALSE;
    for (let i = s1.length - 1; i >= 0; i -= 1) {
        const entry1 = s1[i];
        const entry2 = s2[i];
        const constraint = entry2.constraint.or(entry1.constraint.and(nextConstraint));
        nextConstraint = constraint;
        result.push({
            timeRange: { start: entry1.timeRange.start, end: entry1.timeRange.end },
            constraint: constraint,
        });
    }
    return result.reverse();
}

export function satUntil2(context: SatContext, s1: SatSet, s2: SatSet): SatSet {
    const result: SatSet = [];
    let i = s1.length - 1;
    let j = s2.length - 1;

    let accumulated: Constraint = FALSE;
    while (i >= 0 && j >= 0) {
        const entry1 = s1[i];
        const entry2 = s2[j];
        const start = Math.max(entry1.timeRange.end, entry2.timeRange.start);
        const end = Math.min(entry1.timeRange.end, entry2.timeRange.end);

        if (start <= end) {
            accumulated = entry1.constraint.or(accumulated);
            result.push({
                timeRange: { start, end },
                constraint: entry2.constraint.and(accumulated),
            });
        }
        if (entry1.timeRange.end > entry2.timeRange.end) {
            i -= 1;
        }
        else if (entry2.timeRange.end > entry1.timeRange.end) {
            j -= 1;
        } else {
            i -= 1;
            j -= 1;
        }
    }
    return result.reverse();
};

export function satAt(context: SatContext, formula: Formula, label: string): SatSet {
    let satAt: SatSet = satFalse(context);
    for (const bond of context.bonsFromStart) {
        let newContext = cutSatContext(context, bond.start + 1, bond.end - 1);
        if (newContext.sequenceLength < newContext.sequenceStart) {
            continue;
        }
        const newSat = sat(newContext, formula);
        const newEntry = {
            ...newSat[0],
            timeRange: {
                start: bond.start,
                end: bond.start,
            },
            constraint: newSat[0].constraint.and(eq(label, Number(bond.id))),
        }
        const complementEntry = {
            timeRange: {
                start: bond.start + 1,
                end: context.sequenceLength,
            },
            constraint: FALSE,
        }
        const prev = {
            timeRange: {
                start: context.sequenceStart,
                end: bond.start - 1,
            },
            constraint: FALSE,
        }
        let result = [newEntry];

        if (bond.start > context.sequenceStart) 
            result.unshift(prev);

        if (bond.start < context.sequenceLength)
            result.push(complementEntry);
            

        satAt = satOr(context, satAt, result);
    }

    return satAt;
}
export function satForAll(context: SatContext, satSet: SatSet, label: string): SatSet {
    let result: SatSet = [];
    for (const entry of satSet) {
        let constraint: Constraint = TRUE;
        for (const bond of context.bonsFromStart) {
            if (bond.start >= context.sequenceStart && bond.end <= context.sequenceLength) {
                const substituted = substitute(entry.constraint, label, Number(bond.id));
                constraint = constraint.and(substituted);
            }
        }
        result.push({
            timeRange: entry.timeRange,
            constraint: constraint,
        });
    }
    return result;
}

export function satExists(context: SatContext, satSet: SatSet, label: string): SatSet {
    let result: SatSet = [];
    for (const entry of satSet) {
        let constraint: Constraint = FALSE;
        for (const bond of context.bonsFromStart) {
            if (bond.start >= context.sequenceStart && bond.end <= context.sequenceLength) {
                const substituted = substitute(entry.constraint, label, Number(bond.id));
                constraint = constraint.or(substituted);
            }
        }
        result.push({
            timeRange: entry.timeRange,
            constraint: constraint,
        });
    }
    return result;
}

export function satAnd(context: SatContext, s1: SatSet, s2: SatSet): SatSet {
    const result: SatSet = [];
    [s1, s2] = AlignSatSets(s1, s2);
    for (let i = 0; i < s1.length; i += 1) {
        const entry1 = s1[i];
        const entry2 = s2[i];
        result.push({
            timeRange: { start: entry1.timeRange.start, end: entry1.timeRange.end },
            constraint: entry1.constraint.and(entry2.constraint),
        });
    }
    return result;
}

/**
 * The dot operator return [k,k] true if in that position there are no bonds.
 * Otherwise it returns [k,k] false. 
 */
export function satDot(context: SatContext): SatSet {
    const result: SatSet = [];
    const bondPoints = new Set<number>();
    for (const bond of context.bonsFromStart) {
        if (bond.start >= context.sequenceStart && bond.start <= context.sequenceLength) {
            bondPoints.add(bond.start);
        }
        if (bond.end >= context.sequenceStart && bond.end <= context.sequenceLength) {
            bondPoints.add(bond.end);
        }
    }

    for (let i = context.sequenceStart; i <= context.sequenceLength; i += 1) {
        result.push({
            timeRange: { start: i, end: i },
            constraint: bondPoints.has(i) ? FALSE : TRUE,
        });
    }
    return result;
}


export function sat(context: SatContext, formula: Formula): SatSet {
    switch (formula.kind) {
        case "true":
            return satTrue(context);
        case "false":
            return satFalse(context);
        case "atom":
            return satAtom(context, formula.value);
        case "rho":
            return satRho(context, formula.rho);
        case "dot":
            return satDot(context);
        case "next":
            return satNext(sat(context, formula.formula));
        case "or":
            return satOr(
                context,
                sat(context, formula.left),
                sat(context, formula.right),
            );
        case "and":
            return satAnd(
                context,
                sat(context, formula.left),
                sat(context, formula.right),
            );
        case "eventually":
            return satEventually(context, sat(context, formula.formula));
        case "not":
            return satNot(sat(context, formula.formula));
        case "until":
            return satUntil(
                context,
                sat(context, formula.left),
                sat(context, formula.right),
            );
        case "at":
            return satAt(context, formula.formula, formula.label);
        case "always":
            return satNot(satEventually(context, satNot(sat(context, formula.formula))));
        case "exists":
            return satExists(context, sat(context, formula.formula), formula.label);
        case "forall":
            return satForAll(context, sat(context, formula.formula), formula.label);

    }
}


export function AlignSatSets(s1: SatSet, s2: SatSet): [SatSet, SatSet] {
    const alignedS1: SatSet = [];
    const alignedS2: SatSet = [];
    let i = 0;
    let j = 0;
    let start = 0;
    while (i < s1.length && j < s2.length) {
        let entry1 = s1[i];
        let entry2 = s2[j];
        const end = Math.min(entry1.timeRange.end, entry2.timeRange.end);
        const maxEnd = Math.max(entry1.timeRange.end, entry2.timeRange.end);
        alignedS1.push({
            timeRange: { start, end },
            constraint: entry1.constraint,
        });
        alignedS2.push({
            timeRange: { start, end },
            constraint: entry2.constraint,
        });

        if (entry1.timeRange.end < entry2.timeRange.end) {
            i += 1;
        } else if (entry2.timeRange.end < entry1.timeRange.end) {
            j += 1;
        } else {
            i += 1;
            j += 1;
        }

        start = end + 1;

    }
    return [alignedS1, alignedS2];
}

export function cutSatContext(context: SatContext, start: number, end: number): SatContext {
    const cutSequence = context.sequence.slice(start, end + 1);
    // const cutBondsFromStart = context.bonsFromStart.filter((bond) => bond.start > start && bond.end < end)
    //     .map((bond) => ({
    //         ...bond,
    //         start: bond.start - start,
    //         end: bond.end - start,
    //     }));
    // const cutBondsFromEnd = context.bonsFromEnd.filter((bond) => bond.start > start && bond.end < end)
    //     .map((bond) => ({
    //         ...bond,
    //         start: bond.start - start,
    //         end: bond.end - start,
    //     }));
    return {
        sequence: cutSequence,
        sequenceLength: cutSequence.length - 1,
        sequenceStart: 0,
        bonsFromStart: context.bonsFromStart.map((bond) => ({
            ...bond,
            start: bond.start - start,
            end: bond.end - start,
        })),
        bonsFromEnd: context.bonsFromEnd.map((bond) => ({
            ...bond,
            start: bond.start - start,
            end: bond.end - start,
        })),
    };
}

/** UI SERVICE */
export type ReadableSubstitution = Record<string, string>;

export interface ReadableSatEntry {
    interval: string;
    constraint: string;
    substitutions: ReadableSubstitution[];
    satisfied: boolean;
}

export async function toReadableSatSet(set: SatSet, variables: Set<string>, maxDomain: number, wrapper?: Z3Wrapper): Promise<ReadableSatEntry[]> {
    const result: ReadableSatEntry[] = [];
    wrapper = wrapper || new Z3Wrapper(maxDomain, variables);

    const groups: {
        representative: Constraint;
        entries: typeof set;
    }[] = [];

    for (const entry of set) {
        if (groups.length === 0) {
            groups.push({
                representative: entry.constraint,
                entries: [entry],
            });
            continue;
        }

        const currentGroup = groups[groups.length - 1];

        if (await wrapper.areEquivalent(entry.constraint, currentGroup.representative)) {
            currentGroup.entries.push(entry);
        } else {
            groups.push({
                representative: entry.constraint,
                entries: [entry],
            });
        }
    }

    for (const group of groups) {
        const solutions = await wrapper.getSolutions(group.representative);

        const readableSolutions = solutions.map(solution =>
            Object.keys(solution)
                .sort()
                .reduce<ReadableSubstitution>((acc, variable) => {
                    acc[variable] = solution[variable];
                    return acc;
                }, {})
        );

        for (const entry of group.entries) {
            result.push({
                interval: `[${entry.timeRange.start}, ${entry.timeRange.end}]`,
                constraint: entry.constraint.toString(),
                substitutions: readableSolutions,
                satisfied: readableSolutions.length > 0,
            });
        }
    }
    // Now merge intervals with the same substitutions and satisfied status

    const mergedResult: ReadableSatEntry[] = [];
    for (const entry of result) {
        const lastEntry = mergedResult[mergedResult.length - 1];
        // check if the last entry has the same substitutions and satisfied status as the current entry
        if (lastEntry && lastEntry.satisfied === entry.satisfied && equalsSubstitutions(lastEntry.substitutions || [], entry.substitutions || [])) {
            lastEntry.interval = `[${lastEntry.interval.split(",")[0].slice(1)}, ${entry.interval.split(",")[1].slice(0, -1)}]`;
        }
        else {
            mergedResult.push(entry);
        }
    }

    return mergedResult;
}

export async function justOne(set: SatSet, variables: Set<string>, maxDomain: number, wrapper?: Z3Wrapper): Promise<boolean> {
    wrapper = wrapper || new Z3Wrapper(maxDomain, variables);
    let solver = new Solver();
    let constraint = FALSE;
    variables.forEach(variable => {
        const varInt = Int.const(variable);
        solver.add(varInt.ge(0), varInt.le(maxDomain));
    });
    for (const entry of set) {
        if (await solver.check(entry.constraint) === "sat") {
            return true;
        }
    }
    return false;
}

export function formatFormula(formula: Formula): string {
    switch (formula.kind) {
        case "true":
            return "true";
        case "false":
            return "false";
        case "atom":
            return formula.value;
        case "rho":
            return `${formula.rho.label}${formula.rho.kind === "up" ? ">" : "<"}`;
        case "dot":
            return ".";
        case "not":
            return `!(${formatFormula(formula.formula)})`;
        case "next":
            return `O(${formatFormula(formula.formula)})`;
        case "eventually":
            return `<>(${formatFormula(formula.formula)})`;
        case "always":
            return `[](${formatFormula(formula.formula)})`;
        case "and":
            return `(${formatFormula(formula.left)} & ${formatFormula(formula.right)})`;
        case "or":
            return `(${formatFormula(formula.left)} | ${formatFormula(formula.right)})`;
        case "until":
            return `(${formatFormula(formula.left)} U ${formatFormula(formula.right)})`;
        case "at":
            return `@(${formatFormula(formula.formula)}, ${formula.label})`;
        case "exists":
            return `E(${formatFormula(formula.formula)}, ${formula.label})`;
        case "forall":
            return `A(${formatFormula(formula.formula)}, ${formula.label})`;
    }
}

function equalsSubstitutions(s1: ReadableSubstitution[], s2: ReadableSubstitution[]): boolean {
    if (s1.length !== s2.length) {
        return false;
    }

    for (const subst of s1) {
        for (const key in subst) {
            if (!s2.some(s => s[key] === subst[key])) {
                return false;
            }
        }
    }

    return true;

}