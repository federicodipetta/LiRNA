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

export type TokenType =
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

export interface Token {
  type: TokenType;
  value?: string;
  rho?: AtomicRho;
  pos: number;
}

export interface ParsedFormulaResult {
  formula: LtlFormula | null;
  error?: string;
}
