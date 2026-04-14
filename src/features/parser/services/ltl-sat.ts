import {
  FALSE,
  TRUE,
  andConstraint,
  eqConstraint,
  evaluateConstraint,
  formatConstraint,
  isEqualConstraint,
  negateConstraint,
  orConstraint,
  simplifyConstraint,
  type ConstraintExpr,
} from "./constraint-expr";

export type { ConstraintAssignment, ConstraintExpr } from "./constraint-expr";
export { FALSE, TRUE, andConstraint, evaluateConstraint, formatConstraint, negateConstraint, orConstraint, simplifyConstraint };

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
}

export type AtomicRho =
  | { kind: "up"; label: string }
  | { kind: "down"; label: string };

export type LtlFormula =
  | { kind: "true" }
  | { kind: "false" }
  | { kind: "atom"; value: string }
  | { kind: "not"; formula: LtlFormula }
  | { kind: "or"; left: LtlFormula; right: LtlFormula }
  | { kind: "rho"; rho: AtomicRho }
  | { kind: "next"; formula: LtlFormula }
  | { kind: "until"; left: LtlFormula; right: LtlFormula }
  | { kind: "eventually"; formula: LtlFormula };

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

function sortSatEntries(entries: SatSet): SatSet {
  return [...entries].sort((a, b) => a.range[0] - b.range[0] || a.range[1] - b.range[1]);
}

export function buildSatContext(
  sequence: string,
  pairs: ReadonlyArray<readonly [number, number]>,
): SatContext {
  return {
    sequence,
    sequenceLength: sequence.length,
    arcs: pairs.map(([left, right], index) => ({
      id: String(index + 1),
      start: Math.min(left, right),
      end: Math.max(left, right),
    })),
  };
}

export function satRho(context: SatContext, rho: AtomicRho): SatSet {
  if (context.sequenceLength < 0 || context.arcs.length === 0) {
    return [];
  }

  const entries: SatSet = [];

  for (const arc of sortSatEntries(context.arcs.map((item) => ({ range: [item.start, item.end] as TimeRange, constraint: TRUE })))) {
    const currentArc = context.arcs.find((item) => item.start === arc.range[0] && item.end === arc.range[1]);
    if (!currentArc) {
      continue;
    }

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

  for (let t = 1; t <= context.sequenceLength; t += 1) {
    if (context.sequence[t - 1] === value) {
      appendSatEntry(result, {
        range: [t, t],
        constraint: TRUE,
      });
    }
  }

  return result;
}

export function satNext(set: SatSet): SatSet {
  const shifted = sortSatEntries(set)
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
  const leftNorm = sortSatEntries(left);
  const rightNorm = sortSatEntries(right);
  const elementary = buildElementaryIntervals(sequenceLength, leftNorm, rightNorm);

  const result: SatSet = [];

  for (const [start, end] of elementary) {
    const leftConstraint = findConstraintAt(start, leftNorm);
    const rightConstraint = findConstraintAt(start, rightNorm);
    const curr = orConstraint(leftConstraint, rightConstraint);

    appendSatEntry(result, {
        range: [start, end],
        constraint: curr,
    });
  }

  return result;
}

export function satEventually(sequenceLength: number, set: SatSet): SatSet {
  const normalized = sortSatEntries(set);

  if (normalized.length === 0) {
    return [];
  }

  const result: SatSet = [];
  let accumulated: ConstraintExpr = FALSE;

  for (let i = normalized.length - 1; i >= 0; i -= 1) {
    const current = normalized[i];
    accumulated = orConstraint(accumulated, current.constraint);

    const start = i === 0 ? 0 : normalized[i - 1].range[1] + 1;
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
  const normalized = sortSatEntries(set);
  const result: SatSet = [];

  let currentTime = 0;

  for (const entry of normalized) {
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
  const leftNorm = sortSatEntries(left);
  const rightNorm = sortSatEntries(right);
  const elementary = buildElementaryIntervals(sequenceLength, leftNorm, rightNorm);

  const result: SatSet = [];
  let nextConstraint: ConstraintExpr = FALSE;

  for (let i = elementary.length - 1; i >= 0; i -= 1) {
    const [start, end] = elementary[i];

    const v1 = findConstraintAt(start, leftNorm);
    const v2 = findConstraintAt(start, rightNorm);
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
      return `${formula.rho.label}${formula.rho.kind === "up" ? "↑" : "↓"}`;
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

export interface ReadableSatEntry {
  interval: string;
  constraint: string;
}

export function toReadableSatSet(set: SatSet): ReadableSatEntry[] {
  return set.map((entry) => ({
    interval: `[${entry.range[0]}, ${entry.range[1]}]`,
    constraint: formatConstraint(entry.constraint),
  }));
}

type TokenType =
  | "LPAREN"
  | "RPAREN"
  | "NOT"
  | "OR"
  | "UNTIL"
  | "NEXT"
  | "EVENTUALLY"
  | "TRUE"
  | "FALSE"
  | "ATOM"
  | "RHO"
  | "EOF";

interface Token {
  type: TokenType;
  value?: string;
  rho?: AtomicRho;
  pos: number;
}

function readQuotedAtom(source: string, start: number): { value: string; end: number } {
  const quote = source[start];
  const endQuote = source.indexOf(quote, start + 1);

  if (endQuote === -1) {
    throw new Error(`Unterminated quoted atom at position ${start + 1}`);
  }

  const value = source.slice(start + 1, endQuote).trim();
  if (!/^[ACGU]$/.test(value)) {
    throw new Error(`Invalid atom '${value}' at position ${start + 1}`);
  }

  return { value, end: endQuote + 1 };
}

function isIdentifierStart(ch: string): boolean {
  return /[A-Za-z_]/.test(ch);
}

function isIdentifierChar(ch: string): boolean {
  return /[A-Za-z0-9_]/.test(ch);
}

function skipSpaces(source: string, start: number): number {
  let i = start;
  while (i < source.length && /\s/.test(source[i])) {
    i += 1;
  }
  return i;
}

function readIdentifier(source: string, start: number): { ident: string; end: number } {
  let end = start;
  while (end < source.length && isIdentifierChar(source[end])) {
    end += 1;
  }
  return {
    ident: source.slice(start, end),
    end,
  };
}

function readRhoDirection(
  source: string,
  from: number,
): { direction: AtomicRho["kind"] | null; end: number } {
  const i = skipSpaces(source, from);

  if (source.startsWith("\\uparrow", i) || source.startsWith("\\updattow", i)) {
    return {
      direction: "up",
      end: source.startsWith("\\updattow", i) ? i + 9 : i + 8,
    };
  }

  if (source.startsWith("\\downarrow", i)) {
    return { direction: "down", end: i + 10 };
  }

  if (source.startsWith("up", i)) {
    return { direction: "up", end: i + 2 };
  }

  if (source.startsWith("down", i)) {
    return { direction: "down", end: i + 4 };
  }

  if (source[i] === "↑") {
    return { direction: "up", end: i + 1 };
  }

  if (source[i] === "↓") {
    return { direction: "down", end: i + 1 };
  }

  return { direction: null, end: i };
}

function tokenizeFormula(source: string): Token[] {
  const tokens: Token[] = [];
  let i = 0;

  while (i < source.length) {
    i = skipSpaces(source, i);
    if (i >= source.length) {
      break;
    }

    const ch = source[i];

    if (ch === "'" || ch === '"') {
      const { value, end } = readQuotedAtom(source, i);
      tokens.push({ type: "ATOM", value, pos: i });
      i = end;
      continue;
    }

    if (source.startsWith("<>", i)) {
      tokens.push({ type: "EVENTUALLY", pos: i });
      i += 2;
      continue;
    }

    if (source.startsWith("||", i)) {
      tokens.push({ type: "OR", pos: i });
      i += 2;
      continue;
    }

    if (ch === "|") {
      tokens.push({ type: "OR", pos: i });
      i += 1;
      continue;
    }

    if (ch === "!") {
      tokens.push({ type: "NOT", pos: i });
      i += 1;
      continue;
    }

    if (ch === "(") {
      tokens.push({ type: "LPAREN", pos: i });
      i += 1;
      continue;
    }

    if (ch === ")") {
      tokens.push({ type: "RPAREN", pos: i });
      i += 1;
      continue;
    }

    if (ch === "U") {
      tokens.push({ type: "UNTIL", pos: i });
      i += 1;
      continue;
    }

    if (ch === "O") {
      tokens.push({ type: "NEXT", pos: i });
      i += 1;
      continue;
    }


    if (isIdentifierStart(ch)) {
      const { ident, end } = readIdentifier(source, i);

      if (ident === "true") {
        tokens.push({ type: "TRUE", pos: i });
        i = end;
        continue;
      }

      if (ident === "false") {
        tokens.push({ type: "FALSE", pos: i });
        i = end;
        continue;
      }

      if (/^[ACG]$/.test(ident)) {
        tokens.push({ type: "ATOM", value: ident, pos: i });
        i = end;
        continue;
      }

      if (ident.toLowerCase() === "or") {
        tokens.push({ type: "OR", pos: i });
        i = end;
        continue;
      }

      const direction = readRhoDirection(source, end);
      if (direction.direction) {
        tokens.push({
          type: "RHO",
          pos: i,
          rho: { kind: direction.direction, label: ident },
        });
        i = direction.end;
        continue;
      }
    }

    throw new Error(`Invalid token at position ${i + 1}`);
  }

  tokens.push({ type: "EOF", pos: source.length });
  return tokens;
}

class FormulaParser {
  private readonly tokens: Token[];

  private cursor = 0;

  constructor(tokens: Token[]) {
    this.tokens = tokens;
  }

  parse(): LtlFormula {
    const expression = this.parseUntil();
    this.expect("EOF");
    return expression;
  }

  private parseUntil(): LtlFormula {
    let left = this.parseOr();

    while (this.peek().type === "UNTIL") {
      this.advance();
      const right = this.parseUntil();
      left = { kind: "until", left, right };
    }

    return left;
  }

  private parseOr(): LtlFormula {
    let left = this.parseUnary();

    while (this.peek().type === "OR") {
      this.advance();
      const right = this.parseUnary();
      left = { kind: "or", left, right };
    }

    return left;
  }

  private parseUnary(): LtlFormula {
    const token = this.peek();

    if (token.type === "NOT") {
      this.advance();
      return { kind: "not", formula: this.parseUnary() };
    }

    if (token.type === "NEXT") {
      this.advance();
      return { kind: "next", formula: this.parseUnary() };
    }

    if (token.type === "EVENTUALLY") {
      this.advance();
      return { kind: "eventually", formula: this.parseUnary() };
    }

    return this.parsePrimary();
  }

  private parsePrimary(): LtlFormula {
    const token = this.peek();

    if (token.type === "TRUE") {
      this.advance();
      return { kind: "true" };
    }

    if (token.type === "FALSE") {
      this.advance();
      return { kind: "false" };
    }

    if (token.type === "ATOM" && token.value) {
      this.advance();
      return { kind: "atom", value: token.value };
    }

      if (token.type === "ATOM" && token.value) {
        this.advance();
        return { kind: "atom", value: token.value };
      }

    if (token.type === "RHO" && token.rho) {
      this.advance();
      return { kind: "rho", rho: token.rho };
    }

    if (token.type === "LPAREN") {
      this.advance();
      const expr = this.parseUntil();
      this.expect("RPAREN");
      return expr;
    }

    throw new Error(`Invalid formula near position ${token.pos + 1}`);
  }

  private expect(type: TokenType): Token {
    const token = this.peek();
    if (token.type !== type) {
      throw new Error(`Expected ${type}, found ${token.type} at position ${token.pos + 1}`);
    }
    return this.advance();
  }

  private peek(): Token {
    return this.tokens[this.cursor];
  }

  private advance(): Token {
    const token = this.tokens[this.cursor];
    this.cursor += 1;
    return token;
  }
}

export interface ParsedFormulaResult {
  formula: LtlFormula | null;
  error?: string;
}

export function parseLtlFormula(input: string): ParsedFormulaResult {
  const source = input.trim();
  if (!source) {
    return {
      formula: null,
      error: "Enter an LTL formula.",
    };
  }

  try {
    const tokens = tokenizeFormula(source);
    const parser = new FormulaParser(tokens);
    return {
      formula: parser.parse(),
    };
  } catch (error) {
    return {
      formula: null,
      error: error instanceof Error ? error.message : "Unknown error while parsing LTL.",
    };
  }
}
