import {
  FALSE,
  TRUE,
  andConstraint,
  eqConstraint,
  formatConstraint,
  isEqualConstraint,
  negateConstraint,
  orConstraint,
  type ConstraintExpr,
} from "../constraint-expr";
import type { AtomicRho, LtlFormula } from "./ast";

export type TimeRange = readonly [start: number, end: number];

export interface SatEntry {
  range: TimeRange;
  constraint: ConstraintExpr;
}

export type SatSet = SatEntry[];

export interface SatArc {
  id: string;
  start: number;
  end: number;
}

export interface SatContext {
  sequence: string;
  sequenceLength: number;
  arcs: SatArc[];
  arcsByStart: SatArc[];
  arcsByEnd: SatArc[];
}

export interface ReadableSatEntry {
  interval: string;
  constraint: string;
}

function appendSatEntry(entries: SatSet, entry: SatEntry): void {
  if (entry.range[0] > entry.range[1] || entry.constraint.kind === "false") {
    return;
  }

  const last = entries[entries.length - 1];
  if (last && isEqualConstraint(last.constraint, entry.constraint) && last.range[1] + 1 >= entry.range[0]) {
    entries[entries.length - 1] = {
      range: [last.range[0], Math.max(last.range[1], entry.range[1])],
      constraint: last.constraint,
    };
    return;
  }

  entries.push(entry);
}

function findConstraintAt(time: number, set: SatSet): ConstraintExpr {
  for (const entry of set) {
    if (entry.range[0] <= time && time <= entry.range[1]) {
      return entry.constraint;
    }
  }

  return FALSE;
}

function buildElementaryIntervals(maxTime: number, ...sets: SatSet[]): TimeRange[] {
  const points = new Set<number>([0, maxTime + 1]);

  for (const set of sets) {
    for (const { range } of set) {
      const [start, end] = range;
      points.add(start);
      points.add(end + 1);
    }
  }

  const ordered = [...points]
    .filter((point) => point >= 0 && point <= maxTime + 1)
    .sort((a, b) => a - b);

  const intervals: TimeRange[] = [];

  for (let i = 0; i < ordered.length - 1; i += 1) {
    const start = ordered[i];
    const end = ordered[i + 1] - 1;

    if (start <= end) {
      intervals.push([start, end]);
    }
  }

  return intervals;
}

export function satTop(sequenceLength: number): SatSet {
  if (sequenceLength < 0) {
    return [];
  }

  return [{ range: [0, sequenceLength], constraint: TRUE }];
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
    arcs,
    arcsByStart: byStart,
    arcsByEnd: byEnd,
  };
}

export function satRho(context: SatContext, rho: AtomicRho): SatSet {
  if (context.sequenceLength < 0 || context.arcs.length === 0) {
    return [];
  }

  const entries: SatSet = [];
  const orderedArcs = rho.kind === "up" ? context.arcsByStart : context.arcsByEnd;

  for (const currentArc of orderedArcs) {
    const start = rho.kind === "up" ? currentArc.start : currentArc.end;
    const end = rho.kind === "up" ? currentArc.start : currentArc.end;

    if (start < 0 || end < 0) {
      continue;
    }

    if (start > context.sequenceLength) {
      continue;
    }

    const boundedEnd = Math.min(end, context.sequenceLength);
    if (boundedEnd < start) {
      continue;
    }

    appendSatEntry(entries, {
      range: [start, boundedEnd],
      constraint: eqConstraint(rho.label, currentArc.id),
    });
  }

  return entries;
}

export function satAtom(context: SatContext, value: string): SatSet {
  const result: SatSet = [];

  for (let t = 0; t <= context.sequenceLength; t += 1) {
    if (context.sequence[t] === value) {
      appendSatEntry(result, {
        range: [t, t],
        constraint: TRUE,
      });
    }
  }

  return result;
}

export function satNext(set: SatSet): SatSet {
  const shifted = set
    .map((entry) => {
      const start = entry.range[0] - 1;
      const end = entry.range[1] - 1;

      if (start < 0 || end < 0) {
        return null;
      }

      return {
        range: [start, end] as TimeRange,
        constraint: entry.constraint,
      };
    })
    .filter((entry): entry is SatEntry => entry !== null);

  const result: SatSet = [];
  for (const entry of shifted) {
    appendSatEntry(result, entry);
  }

  return result;
}

export function satOr(sequenceLength: number, left: SatSet, right: SatSet): SatSet {
  const elementary = buildElementaryIntervals(sequenceLength, left, right);
  const result: SatSet = [];

  for (const [start, end] of elementary) {
    const leftConstraint = findConstraintAt(start, left);
    const rightConstraint = findConstraintAt(start, right);
    const curr = orConstraint(leftConstraint, rightConstraint);

    appendSatEntry(result, {
      range: [start, end],
      constraint: curr,
    });
  }

  return result;
}

export function satEventually(sequenceLength: number, set: SatSet): SatSet {
  if (set.length === 0) {
    return [];
  }

  const result: SatSet = [];
  let accumulated: ConstraintExpr = FALSE;

  for (let i = set.length - 1; i >= 0; i -= 1) {
    const current = set[i];
    accumulated = orConstraint(accumulated, current.constraint);

    const start = i === 0 ? 0 : set[i - 1].range[1] + 1;
    const end = current.range[1];

    if (start <= end && start <= sequenceLength) {
      appendSatEntry(result, {
        range: [start, Math.min(end, sequenceLength)],
        constraint: accumulated,
      });
    }
  }

  return result.reverse();
}

export function satNot(sequenceLength: number, set: SatSet): SatSet {
  const result: SatSet = [];
  let currentTime = 0;

  for (const entry of set) {
    const [start, end] = entry.range;

    if (start > currentTime) {
      appendSatEntry(result, {
        range: [currentTime, start - 1],
        constraint: TRUE,
      });
    }

    appendSatEntry(result, {
      range: [start, end],
      constraint: negateConstraint(entry.constraint),
    });

    currentTime = end + 1;
  }

  if (currentTime <= sequenceLength) {
    appendSatEntry(result, {
      range: [currentTime, sequenceLength],
      constraint: TRUE,
    });
  }

  return result;
}

export function satUntil(sequenceLength: number, left: SatSet, right: SatSet): SatSet {
  const elementary = buildElementaryIntervals(sequenceLength, left, right);
  const result: SatSet = [];
  let nextConstraint: ConstraintExpr = FALSE;

  for (let i = elementary.length - 1; i >= 0; i -= 1) {
    const [start, end] = elementary[i];

    const v1 = findConstraintAt(start, left);
    const v2 = findConstraintAt(start, right);
    const current = orConstraint(v2, andConstraint(v1, nextConstraint));

    appendSatEntry(result, {
      range: [start, end],
      constraint: current,
    });

    nextConstraint = current;
  }

  return result.reverse();
}

export function sat(context: SatContext, formula: LtlFormula): SatSet {
  switch (formula.kind) {
    case "true":
      return satTop(context.sequenceLength);
    case "false":
      return [];
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
      return satEventually(context.sequenceLength, sat(context, formula.formula));
    case "not":
      return satNot(context.sequenceLength, sat(context, formula.formula));
    case "until":
      return satUntil(
        context.sequenceLength,
        sat(context, formula.left),
        sat(context, formula.right),
      );
  }
}

export function formatFormula(formula: LtlFormula): string {
  switch (formula.kind) {
    case "true":
      return "true";
    case "false":
      return "false";
    case "atom":
      return formula.value;
    case "rho":
      return `${formula.rho.label}${formula.rho.kind === "up" ? ">" : "<"}`;
    case "not":
      return `!(${formatFormula(formula.formula)})`;
    case "next":
      return `O(${formatFormula(formula.formula)})`;
    case "eventually":
      return `<>(${formatFormula(formula.formula)})`;
    case "or":
      return `(${formatFormula(formula.left)} | ${formatFormula(formula.right)})`;
    case "until":
      return `(${formatFormula(formula.left)} U ${formatFormula(formula.right)})`;
  }
}

export function toReadableSatSet(set: SatSet): ReadableSatEntry[] {
  return set.map((entry) => ({
    interval: `[${entry.range[0]}, ${entry.range[1]}]`,
    constraint: formatConstraint(entry.constraint),
  }));
}
