import { AtomicRho, LtlFormula } from "./ast";
import { Constraint } from "./constraint-set";
import { satTop } from "./evaluator";

export type BasePair = [first: number, second: number];



export type SatContext = {
    numberOfVariables: number;
    bonsFromStart: BasePair[];
    bonsFromEnd: BasePair[];
    sequence: string;
    /**
     * The length of the sequence, is equal to @code{@link sequence}.length - 1 to use for 1-based indexing.
     */
    sequenceLength: number;
}

export type TimeRange = [start: number, end: number];

export type SatEntry = {
    constraint: Constraint;
    timeRange: TimeRange;
}

export type SatSet = SatEntry[];

/*
* UNARY OPERATORS 
*/

export function satTrue(context: SatContext): SatSet {
    return [];
}

export function satFalse(context: SatContext): SatSet {return [];}

export function satAtom(context: SatContext, value: string): SatSet {return [];}

export function satNext(set: SatSet): SatSet {return [];}

export function satNot(context: SatContext, set: SatSet): SatSet {return [];}

export function satRho(context: SatContext, rho: AtomicRho): SatSet { return [];}

export function satEventually(context: SatContext, set: SatSet): SatSet {return [];}

/*
* BINARY OPERATORS
*/

export function satOr(sequenceLength: number, s1: SatSet, s2: SatSet): SatSet {return [];}

export function satUntil(context: SatContext, s1: SatSet, s2: SatSet): SatSet {return [];}





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
            return satNot(context, sat(context, formula.formula));
        case "until":
            return satUntil(
                context,
                sat(context, formula.left),
                sat(context, formula.right),
            );

    }
}