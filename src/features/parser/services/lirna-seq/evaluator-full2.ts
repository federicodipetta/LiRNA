import { AtomicRho, LtlFormula } from "./ast";
import { Constraint, TRUE, FALSE, eq, or as z3Or } from "./z3Wrapper";

export type BasePair = {
  id: number;
  start: number;
  end: number;
};

export type SatContext = {
  bonsFromStart: BasePair[];
  bonsFromEnd: BasePair[];
  sequence: string;
  /**
   * The length of the sequence, is equal to @code{@link sequence}.length - 1 to use for 1-based indexing.
   */
  sequenceLength: number;
};

export type SatSet = {
  // Inclusive segment ends. Segment i starts at 0 (i=0) or ends[i-1] + 1.
  ends: Uint32Array;
  // constraints[i] applies to segment that ends at ends[i].
  constraints: Constraint[];
};

function sameConstraint(left: Constraint, right: Constraint): boolean {
  return left === right;
}

function segmentStart(set: SatSet, index: number): number {
  return index === 0 ? 0 : set.ends[index - 1] + 1;
}

function constraintAt(set: SatSet, position: number): Constraint {
  return set.constraints[position];
}


export function buildSatContext(sequence: string, pairs: BasePair[]): SatContext {
  return {
    bonsFromStart: [...pairs].sort((a, b) => a.start - b.start || a.end - b.end),
    bonsFromEnd: [...pairs].sort((a, b) => a.end - b.end || a.start - b.start),
    sequence,
    sequenceLength: sequence.length - 1,
  };
}

/*
 * UNARY OPERATORS
 */

export function satTrue(context: SatContext): SatSet {
    let ends = new Uint32Array(1);
    ends[0] = context.sequenceLength;
    return {
        ends: ends,
        constraints: [TRUE],
    }
}

export function satFalse(context: SatContext): SatSet {
    let ends = new Uint32Array(1);
    ends[0] = context.sequenceLength;
    return {
        ends: ends,
        constraints: [FALSE],
    }
}

export function satAtom(context: SatContext, value: string): SatSet {
    const ends: number[] = [];
    const constraints: Constraint[] = [];

    let isTrue = context.sequence[0] === value;
    for (let t = 0; t <= context.sequenceLength; t += 1) {
        const current = context.sequence[t] === value;
        if (current !== isTrue) {
            ends.push(t - 1);
            constraints.push(isTrue ? TRUE : FALSE);
            isTrue = current;
        }
    }

    ends.push(context.sequenceLength);
    constraints.push(isTrue ? TRUE : FALSE);
    return {
        ends: new Uint32Array(ends),
        constraints: constraints
    };
}

export function satNext(context: SatContext, set: SatSet): SatSet {
  if (context.sequenceLength < 0 || set.ends.length === 0) {
    return { ends: new Uint32Array(0), constraints: [] };
  }

  const shiftedEnds: number[] = [];
  const shiftedConstraints: Constraint[] = [];

  for (let i = 0; i < set.ends.length; i += 1) {
    const start = segmentStart(set, i);
    const end = set.ends[i];
    const shiftedStart = Math.max(0, start - 1);
    const shiftedEnd = Math.max(0, end - 1);

    if (shiftedEnd < shiftedStart) {
      continue;
    }

    if (shiftedEnds.length > 0 && shiftedEnd <= shiftedEnds[shiftedEnds.length - 1]) {
      continue;
    }

    shiftedEnds.push(shiftedEnd);
    shiftedConstraints.push(set.constraints[i]);
  }

  // X phi is false on the last instant.
  if (shiftedEnds.length === 0 || shiftedEnds[shiftedEnds.length - 1] < context.sequenceLength) {
    shiftedEnds.push(context.sequenceLength);
    shiftedConstraints.push(FALSE);
  }

  return {
    ends: new Uint32Array(shiftedEnds),
    constraints: shiftedConstraints
  };
}

export function satNot(context: SatContext, set: SatSet): SatSet {
  const constraints = set.constraints.map((constraint) => {
    if (constraint === TRUE) {
      return FALSE;
    }

    if (constraint === FALSE) {
      return TRUE;
    }

    return constraint.not();
  });

  return {
    ends: new Uint32Array(Array.from(set.ends)),
    constraints: constraints
  };
}

function disjunctionOf(constraints: Constraint[]): Constraint {
  if (constraints.length === 0) {
    return FALSE;
  }

  let current = constraints[0];
  for (let i = 1; i < constraints.length; i += 1) {
    current = z3Or(current, constraints[i]);
  }

  return current;
}

export function satRho(context: SatContext, rho: AtomicRho): SatSet {
  if (context.sequenceLength < 0) {
    return { ends: new Uint32Array(0), constraints: [] };
  }
  const orderedBonds = rho.kind === "up" ? context.bonsFromStart : context.bonsFromEnd;
  let ends = new Uint32Array(orderedBonds.length);
  let endsIndex = 0;
  let constraints = [];
  for (const bond of orderedBonds) {
    const position = rho.kind === "up" ? bond.start : bond.end;
    if (position !== 0) {
        ends[0] = position - 1;
        constraints.push(TRUE);
    }
    ends[endsIndex++] = position - 1;
    constraints.push(eq(rho.label, bond.id));
  }
  return {
    ends: ends,
    constraints: constraints
  };
}

export function satEventually(context: SatContext, set: SatSet): SatSet {
  if (set.ends.length === 0) {
    return satFalse(context);
  }

  const constraints = [...set.constraints];
  for (let i = constraints.length - 2; i >= 0; i -= 1) {
    constraints[i] = z3Or(constraints[i], constraints[i + 1]);
  }

  return {
    ends: new Uint32Array(Array.from(set.ends)),
    constraints: constraints
  };
}

/*
 * BINARY OPERATORS
 */

export function satOr(sequenceLength: number, s1: SatSet, s2: SatSet): SatSet {
  if (sequenceLength < 0) {
    return { ends: new Uint32Array(0), constraints: [] };
  }

  const unifiedEnds: number[] = [];
  let i = 0;
  let j = 0;

  while (i < s1.ends.length && j < s2.ends.length) {
    if (s1.ends[i] < s2.ends[j]) {
      unifiedEnds.push(s1.ends[i]);
      i += 1;
    } else if (s2.ends[j] < s1.ends[i]) {
      unifiedEnds.push(s2.ends[j]);
      j += 1;
    } else {
      unifiedEnds.push(s1.ends[i]);
      i += 1;
      j += 1;
    }
  }

  while (i < s1.ends.length) {
    unifiedEnds.push(s1.ends[i]);
    i += 1;
  }

  while (j < s2.ends.length) {
    unifiedEnds.push(s2.ends[j]);
    j += 1;
  }

  if (unifiedEnds.length === 0 || unifiedEnds[unifiedEnds.length - 1] < sequenceLength) {
    unifiedEnds.push(sequenceLength);
  }

  const constraints: Constraint[] = unifiedEnds.map((end) => {
    const left = constraintAt(s1, end);
    const right = constraintAt(s2, end);
    return z3Or(left, right);
  });

  return {
    ends: new Uint32Array(unifiedEnds),
    constraints: constraints
  };
}

export function satUntil(context: SatContext, _s1: SatSet, _s2: SatSet): SatSet {
  // TODO: implement with partition-based semantics.
  return satFalse(context);
}

export function toEntries(set: SatSet): Array<{ start: number; end: number; constraint: Constraint }> {
  const entries: Array<{ start: number; end: number; constraint: Constraint }> = [];
  for (let i = 0; i < set.ends.length; i += 1) {
    entries.push({
      start: segmentStart(set, i),
      end: set.ends[i],
      constraint: set.constraints[i],
    });
  }

  return entries;
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
      return satNext(context, sat(context, formula.formula));
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
            default: return satFalse(context);
  }
}
