export type AtomicRho =
  | { kind: "up"; label: string }
  | { kind: "down"; label: string };

export type LtlFormula =
  | { kind: "true" }
  | { kind: "false" }
  | { kind: "atom"; value: string }
  | { kind: "not"; formula: LtlFormula }
  | { kind: "and"; left: LtlFormula; right: LtlFormula }
  | { kind: "or"; left: LtlFormula; right: LtlFormula }
  | { kind: "rho"; rho: AtomicRho }
  | { kind: "next"; formula: LtlFormula }
  | { kind: "until"; left: LtlFormula; right: LtlFormula }
  | { kind: "eventually"; formula: LtlFormula }
  | { kind: "at"; formula: LtlFormula, label: string }
  | { kind: "always"; formula: LtlFormula }
  | { kind: "exists"; formula: LtlFormula, label: string }
  | { kind: "forall"; formula: LtlFormula, label: string }
  ;

export type TokenType =
  | "LPAREN"
  | "RPAREN"
  | "NOT"
  | "AND"
  | "OR"
  | "PIPE_IMPL"
  | "UNTIL"
  | "NEXT"
  | "EVENTUALLY"
  | "ALWAYS"
  | "TRUE"
  | "FALSE"
  | "ATOM"
  | "LABEL"
  | "AT"
  | "RHO"
  | "EXISTS"
  | "FORALL"
  | "EOF"
  ;

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
