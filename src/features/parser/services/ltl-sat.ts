export type TimeRange = readonly [start: number, end: number];

export type ConstraintExpr =
  | { kind: "top" }
  | { kind: "bottom" }
  | { kind: "atom"; value: string }
  | { kind: "not"; expr: ConstraintExpr }
  | { kind: "and"; left: ConstraintExpr; right: ConstraintExpr }
  | { kind: "or"; left: ConstraintExpr; right: ConstraintExpr };

export interface SatEntry {
  range: TimeRange;
  constraint: ConstraintExpr;
}

export type SatSet = SatEntry[];

export type AtomicRho =
  | { kind: "up"; label: string }
  | { kind: "down"; label: string };

export type LtlFormula =
  | { kind: "true" }
  | { kind: "false" }
  | { kind: "not"; formula: LtlFormula }
  | { kind: "or"; left: LtlFormula; right: LtlFormula }
  | { kind: "rho"; rho: AtomicRho }
  | { kind: "next"; formula: LtlFormula }
  | { kind: "until"; left: LtlFormula; right: LtlFormula }
  | { kind: "eventually"; formula: LtlFormula };

export const TOP: ConstraintExpr = { kind: "top" };
export const BOTTOM: ConstraintExpr = { kind: "bottom" };

function atom(value: string): ConstraintExpr {
  return { kind: "atom", value };
}

function serializeConstraint(expr: ConstraintExpr): string {
  switch (expr.kind) {
    case "top":
      return "TOP";
    case "bottom":
      return "BOTTOM";
    case "atom":
      return `ATOM(${expr.value})`;
    case "not":
      return `NOT(${serializeConstraint(expr.expr)})`;
    case "and":
      return `AND(${serializeConstraint(expr.left)},${serializeConstraint(expr.right)})`;
    case "or":
      return `OR(${serializeConstraint(expr.left)},${serializeConstraint(expr.right)})`;
  }
}

function isEqualConstraint(a: ConstraintExpr, b: ConstraintExpr): boolean {
  return serializeConstraint(a) === serializeConstraint(b);
}

function negateConstraint(expr: ConstraintExpr): ConstraintExpr {
  if (expr.kind === "top") {
    return BOTTOM;
  }

  if (expr.kind === "bottom") {
    return TOP;
  }

  if (expr.kind === "not") {
    return expr.expr;
  }

  return { kind: "not", expr };
}

function andConstraint(left: ConstraintExpr, right: ConstraintExpr): ConstraintExpr {
  if (left.kind === "bottom" || right.kind === "bottom") {
    return BOTTOM;
  }

  if (left.kind === "top") {
    return right;
  }

  if (right.kind === "top") {
    return left;
  }

  if (isEqualConstraint(left, right)) {
    return left;
  }

  return { kind: "and", left, right };
}

function orConstraint(left: ConstraintExpr, right: ConstraintExpr): ConstraintExpr {
  if (left.kind === "top" || right.kind === "top") {
    return TOP;
  }

  if (left.kind === "bottom") {
    return right;
  }

  if (right.kind === "bottom") {
    return left;
  }

  if (isEqualConstraint(left, right)) {
    return left;
  }

  return { kind: "or", left, right };
}

function normalizeSatSet(entries: SatSet): SatSet {
  const sorted = [...entries]
    .filter((entry) => entry.range[0] <= entry.range[1] && entry.constraint.kind !== "bottom")
    .sort((a, b) => a.range[0] - b.range[0] || a.range[1] - b.range[1]);

  if (sorted.length === 0) {
    return [];
  }

  const normalized: SatSet = [
    {
      range: sorted[0].range,
      constraint: sorted[0].constraint,
    },
  ];

  for (let i = 1; i < sorted.length; i += 1) {
    const current = sorted[i];
    const last = normalized[normalized.length - 1];

    if (
      isEqualConstraint(last.constraint, current.constraint) &&
      last.range[1] + 1 >= current.range[0]
    ) {
      normalized[normalized.length - 1] = {
        range: [last.range[0], Math.max(last.range[1], current.range[1])],
        constraint: last.constraint,
      };
      continue;
    }

    normalized.push(current);
  }

  return normalized;
}

function findConstraintAt(time: number, set: SatSet): ConstraintExpr {
  for (const entry of set) {
    if (entry.range[0] <= time && time <= entry.range[1]) {
      return entry.constraint;
    }
  }

  return BOTTOM;
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

  return [{ range: [0, sequenceLength], constraint: TOP }];
}

export function satRho(sequenceLength: number, rho: AtomicRho): SatSet {
  if (sequenceLength <= 0) {
    return [];
  }

  const entries: SatSet = [];

  for (let t = 1; t <= sequenceLength; t += 1) {
    const comparison =
      rho.kind === "up"
        ? `arc(${rho.label}).start_${t} > arc(${rho.label}).start_${t - 1}`
        : `arc(${rho.label}).end_${t} < arc(${rho.label}).end_${t - 1}`;

    entries.push({
      range: [t, t],
      constraint: atom(comparison),
    });
  }

  return entries;
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

  return normalizeSatSet(shifted);
}

export function satOr(sequenceLength: number, left: SatSet, right: SatSet): SatSet {
  const leftNorm = normalizeSatSet(left);
  const rightNorm = normalizeSatSet(right);
  const elementary = buildElementaryIntervals(sequenceLength, leftNorm, rightNorm);

  const result: SatSet = [];

  for (const [start, end] of elementary) {
    const leftConstraint = findConstraintAt(start, leftNorm);
    const rightConstraint = findConstraintAt(start, rightNorm);
    const curr = orConstraint(leftConstraint, rightConstraint);

    if (curr.kind !== "bottom") {
      result.push({
        range: [start, end],
        constraint: curr,
      });
    }
  }

  return normalizeSatSet(result);
}

export function satEventually(sequenceLength: number, set: SatSet): SatSet {
  const normalized = normalizeSatSet(set);

  if (normalized.length === 0) {
    return [];
  }

  const result: SatSet = [];
  let accumulated: ConstraintExpr = BOTTOM;

  for (let i = normalized.length - 1; i >= 0; i -= 1) {
    const current = normalized[i];
    accumulated = orConstraint(accumulated, current.constraint);

    const start = i === 0 ? 0 : normalized[i - 1].range[1] + 1;
    const end = current.range[1];

    if (start <= end && start <= sequenceLength) {
      result.push({
        range: [start, Math.min(end, sequenceLength)],
        constraint: accumulated,
      });
    }
  }

  return normalizeSatSet(result.reverse());
}

export function satNot(sequenceLength: number, set: SatSet): SatSet {
  const normalized = normalizeSatSet(set);
  const result: SatSet = [];

  let currentTime = 0;

  for (const entry of normalized) {
    const [start, end] = entry.range;

    if (start > currentTime) {
      result.push({
        range: [currentTime, start - 1],
        constraint: TOP,
      });
    }

    result.push({
      range: [start, end],
      constraint: negateConstraint(entry.constraint),
    });

    currentTime = end + 1;
  }

  if (currentTime <= sequenceLength) {
    result.push({
      range: [currentTime, sequenceLength],
      constraint: TOP,
    });
  }

  return normalizeSatSet(result);
}

export function satUntil(sequenceLength: number, left: SatSet, right: SatSet): SatSet {
  const leftNorm = normalizeSatSet(left);
  const rightNorm = normalizeSatSet(right);
  const elementary = buildElementaryIntervals(sequenceLength, leftNorm, rightNorm);

  const result: SatSet = [];
  let nextConstraint: ConstraintExpr = BOTTOM;

  for (let i = elementary.length - 1; i >= 0; i -= 1) {
    const [start, end] = elementary[i];

    const v1 = findConstraintAt(start, leftNorm);
    const v2 = findConstraintAt(start, rightNorm);
    const current = orConstraint(v2, andConstraint(v1, nextConstraint));

    if (current.kind !== "bottom") {
      result.push({
        range: [start, end],
        constraint: current,
      });
    }

    nextConstraint = current;
  }

  return normalizeSatSet(result.reverse());
}

export function sat(sequenceLength: number, formula: LtlFormula): SatSet {
  switch (formula.kind) {
    case "true":
      return satTop(sequenceLength);
    case "false":
      return [];
    case "rho":
      return satRho(sequenceLength, formula.rho);
    case "next":
      return satNext(sat(sequenceLength, formula.formula));
    case "or":
      return satOr(
        sequenceLength,
        sat(sequenceLength, formula.left),
        sat(sequenceLength, formula.right),
      );
    case "eventually":
      return satEventually(sequenceLength, sat(sequenceLength, formula.formula));
    case "not":
      return satNot(sequenceLength, sat(sequenceLength, formula.formula));
    case "until":
      return satUntil(
        sequenceLength,
        sat(sequenceLength, formula.left),
        sat(sequenceLength, formula.right),
      );
  }
}

export function formatConstraint(expr: ConstraintExpr): string {
  switch (expr.kind) {
    case "top":
      return "true";
    case "bottom":
      return "false";
    case "atom":
      return expr.value;
    case "not":
      return `!(${formatConstraint(expr.expr)})`;
    case "and":
      return `(${formatConstraint(expr.left)} && ${formatConstraint(expr.right)})`;
    case "or":
      return `(${formatConstraint(expr.left)} || ${formatConstraint(expr.right)})`;
  }
}

export function formatFormula(formula: LtlFormula): string {
  switch (formula.kind) {
    case "true":
      return "true";
    case "false":
      return "false";
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
  | "RHO"
  | "EOF";

interface Token {
  type: TokenType;
  value?: string;
  rho?: AtomicRho;
  pos: number;
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

    throw new Error(`Token non valido in posizione ${i + 1}`);
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

    throw new Error(`Formula non valida vicino alla posizione ${token.pos + 1}`);
  }

  private expect(type: TokenType): Token {
    const token = this.peek();
    if (token.type !== type) {
      throw new Error(`Atteso ${type}, trovato ${token.type} alla posizione ${token.pos + 1}`);
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
      error: "Inserisci una formula LTL.",
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
      error: error instanceof Error ? error.message : "Errore sconosciuto durante il parsing LTL.",
    };
  }
}
