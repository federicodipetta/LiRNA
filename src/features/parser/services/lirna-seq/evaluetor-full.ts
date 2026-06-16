import { AtomicRho, LtlFormula } from "./ast";
import { Constraint, TRUE, FALSE, eq } from "./z3Wrapper";

export type BasePair =  {
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

  const byStart = [...arcs].sort((a, b) => a.start - b.start || a.end - b.end || Number(a.id) - Number(b.id));
  const byEnd = [...arcs].sort((a, b) => a.end - b.end || a.start - b.start || Number(a.id) - Number(b.id));

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

export function satFalse(context: SatContext): SatSet {return [{
    constraint: FALSE,
    timeRange: { start: context.sequenceStart, end: context.sequenceLength },
}]}

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
    set.map((entry) => {
        entry.timeRange = {
            start: entry.timeRange.start - 1,
            end: entry.timeRange.end - 1,
        }
        if (entry.timeRange.start < 0)
            entry.timeRange.start = 0;
        return entry;
    })
    // Remove the entry corresponding to time 0, as it does not have a predecessor.
    .filter((entry) => entry.timeRange.start <= 0 && entry.timeRange.end < 0)
    return set;
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
    const orderedBonds = rho.kind === "up" ? context.bonsFromStart : context.bonsFromEnd;
    let lastPosition = context.sequenceStart;
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
    for (let i = set.length - 1; i > 0; i -= 1) {
        if (set[i].constraint !== FALSE) {
           constraint = constraint.or(set[i].constraint);
        }
        result.push({
            timeRange: {
                start: set[i].timeRange.start,
                end: set[i].timeRange.end,
            },
            constraint: constraint,
        });
    }
    if (set[0].constraint !== FALSE) 
        result.push({
            timeRange: {
                start: context.sequenceStart,
                end: set[0].timeRange.end,
            },
            constraint: constraint.or(set[0].constraint),
        });
    else 
        result[result.length - 1].timeRange.start = context.sequenceStart;
    return result.reverse();
}

/*
* BINARY OPERATORS
*/

export function satOr(sequenceLength: number, s1: SatSet, s2: SatSet): SatSet {
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

export function satAt(context: SatContext, formula: LtlFormula): SatSet {
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
                start: context.sequenceStart,
                end: bond.start - 1,
            },
            constraint: newSat[0].constraint.and(eq("l", Number(bond.id))),
        }
        const complementEntry = {
            timeRange: {
                start: bond.start,
                end: context.sequenceLength,
            },
            constraint: FALSE,
        }
        satAt = satOr(context.sequenceLength, satAt, [newEntry, complementEntry]);
    } 
    
    return satAt;
}

export function sat(context: SatContext, formula: LtlFormula): SatSet {
    switch (formula.kind) {
        case "true":
            return satTrue(context);
        case "false":
            return satFalse(context);
        case "atom":
            return satAtom(context, formula.value);
        case "rho":
            return satRho(context, formula.rho);
        case "next":
            return satNext(sat(context, formula.formula));
        case "or":
            return satOr(
                context.sequenceLength,
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
        default: return satFalse(context);
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
    const cutBondsFromStart = context.bonsFromStart.filter((bond) => bond.start > start || bond.end < end)
        .map((bond) => ({
            ...bond,
            start: bond.start - start,
            end: bond.end - start,
        }));
    const cutBondsFromEnd = context.bonsFromEnd.filter((bond) => bond.start > start || bond.end < end)
        .map((bond) => ({
            ...bond,
            start: bond.start - start,
            end: bond.end - start,
        }));
    return {
        sequence: cutSequence,
        sequenceLength: cutSequence.length - 1,
        sequenceStart: 0,
        bonsFromStart: cutBondsFromStart,
        bonsFromEnd: cutBondsFromEnd,
    };
}