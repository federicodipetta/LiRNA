
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
var NUMBER_OF_BITS = 64;
/**
 * Constant to change when the number of bits in a mask changes. The number of bits is indicated by the number of bonds in the current structure.
 */
var FULL_MASK = BigInt.asUintN(NUMBER_OF_BITS, BigInt("-1"));

export function setUpModule(numberOfBits: number) {
    NUMBER_OF_BITS = numberOfBits;
    FULL_MASK = BigInt.asUintN(NUMBER_OF_BITS, BigInt("-1"));
}

