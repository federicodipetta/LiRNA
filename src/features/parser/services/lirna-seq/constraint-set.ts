
export type BitMask = bigint;
/**
 * A constraint is a mapping from labels to bit masks. Where a label is not present in the map meand that is
 * equal to FULL_MASK, which means that all bits are set to 1, and thus the constraint is satisfied for any value of that label.
 */
export type Constraint = {
    map: {
        [label: number]: BitMask;
    }
}

export const ZERO = BigInt(0);
export var NUMBER_OF_BITS = 64;
/**
 * Constant to change when the number of bits in a mask changes. The number of bits is indicated by the number of bonds in the current structure.
 */
export var FULL_MASK = BigInt.asUintN(NUMBER_OF_BITS, BigInt("-1"));

/**
 * In place on b
 * @param a Constraint to apply the or operator with b
 * @param b b the constraint to apply the or operator on, and also the one that is modified in place
 */
export function or(a: Constraint, b: Constraint): void {
    for (const label in b.map) {
        b.map[label] = b.map[label] | (a.map[label] === undefined ? FULL_MASK : a.map[label]);
        if (b.map[label] === FULL_MASK) {
            delete b.map[label];
        }
    }
}

/**
 * And operator in place on b
 * @param a The constraint to apply the and operator on, and also the one that is modified in place
 * @param b Constraint to apply the and operator with a
 */
export function and(a: Constraint, b: Constraint): void {
    for (const label in b.map) {
        b.map[label] = b.map[label] & (a.map[label] === undefined ? FULL_MASK : a.map[label]);
    }
}

export function not(a: Constraint): Constraint {
    const result: Constraint = { map: {} };
    for (const label in a.map) {
        result.map[label] = ~a.map[label] & FULL_MASK;
    }
    // NOW i need to add all the labels that are not in a.map, which are equal to FULL_MASK, and thus their negation is 0
    for (let i = 0; i < NUMBER_OF_BITS; i++) {
        if (a.map[i] === undefined) {
            result.map[i] = ZERO;
        }
    }
    return result;
}

export function isSatisfiable(constraint: Constraint): boolean {
    for (const label in constraint.map) {
        if (constraint.map[label] === ZERO) {
            return false;
        }
    }
    return true;
}

export function isCorrectAssignment(constraint: Constraint, label: number, value: number): boolean {
    const mask = constraint.map[label];
    if (mask === undefined) {
        return true;
    }
    return (mask & (BigInt(1) << BigInt(value))) !== ZERO;
}

