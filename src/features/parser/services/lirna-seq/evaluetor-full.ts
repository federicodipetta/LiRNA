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

export function buildSatContext(sequence: string, pairs: BasePair[]): SatContext {
    return {
        bonsFromStart: pairs,
        bonsFromEnd: pairs.reverse(),
        sequence: sequence,
        sequenceLength: sequence.length - 1,
    };
}

/*
* UNARY OPERATORS 
*/

export function satTrue(context: SatContext): SatSet {
    return [{
        constraint: TRUE,
        timeRange: { start: 0, end: context.sequenceLength },
    }];
}

export function satFalse(context: SatContext): SatSet {return [{
    constraint: FALSE,
    timeRange: { start: 0, end: context.sequenceLength },
}]}

export function satAtom(context: SatContext, value: string): SatSet {
    const result: SatSet = [];
    let isTrue = context.sequence[0] === value;
    let currentStart = 0;
    for (let t = 0; t <= context.sequenceLength; t += 1) {
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
    for (const entry of set) {
        entry.timeRange = {
            start: entry.timeRange.start - 1,
            end: entry.timeRange.end - 1,
        };
        if (entry.timeRange.start < 0) {
            entry.timeRange.start = 0;
        }
        if (entry.timeRange.end < 0) {
            entry.timeRange.end = 0;
        }
    }
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
    const lastPosition = 0;
    for (const currentBond of orderedBonds) {
        const postiion = rho.kind === "up" ? currentBond.start : currentBond.end;

        if (postiion < 0 || postiion > context.sequenceLength) {
            continue;
        }

        if (postiion !== lastPosition) {
            entries.push({
                timeRange: { start: postiion, end: postiion },
                constraint: FALSE,
            });
        }

        entries.push({
            timeRange: { start: postiion, end: postiion },
            constraint: eq(rho.label, Number(currentBond.id)),
        })
    }

    return entries;
}

export function satEventually(context: SatContext, set: SatSet): SatSet {
    let result = [];
    let constraint = FALSE;
    for (let i = set.length - 1; i > 0; i += 1) {
        constraint = constraint.or(set[i].constraint);
        result.push({
            timeRange: {
                start: set[i - 1].timeRange.end,
                end: set[i].timeRange.end,
            },
            constraint: constraint,
        });
    }
    result.push({
        timeRange: {
            start: 0,
            end: set[0].timeRange.end,
        },
        constraint: constraint.or(set[0].constraint),
    });
    return result;
}

/*
* BINARY OPERATORS
*/

export function satOr(sequenceLength: number, s1: SatSet, s2: SatSet): SatSet {
    const result: SatSet = [];
    let i = 0;
    let j = 0;
    while (i < s1.length && j < s2.length) {
        const entry1 = s1[i];
        const entry2 = s2[j];
        const start = Math.max(entry1.timeRange.start, entry2.timeRange.start);
        const end = Math.min(entry1.timeRange.end, entry2.timeRange.end);


        if (start <= end) {
            result.push({
                timeRange: { start, end },
                constraint: entry1.constraint.or(entry2.constraint),
            });
        }
        if (entry1.timeRange.end < entry2.timeRange.end) {
            i += 1;
        }
        else if (entry2.timeRange.end < entry1.timeRange.end) {
            j += 1;
        }
    }
    return result;
}

export function satUntil(context: SatContext, s1: SatSet, s2: SatSet): SatSet {
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
        }
    }
    return result.reverse();
};





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