export type AtomicRho =
  | { kind: "up"; label: string }
  | { kind: "down"; label: string };

export type LiRNAFormula =
  | { kind: "true" }
  | { kind: "false" }
  | { kind: "atom"; value: string }
  | { kind: "not"; formula: LiRNAFormula }
  | { kind: "and"; left: LiRNAFormula; right: LiRNAFormula }
  | { kind: "or"; left: LiRNAFormula; right: LiRNAFormula }
  | { kind: "rho"; rho: AtomicRho }
  | { kind: "dot" }
  | { kind: "next"; formula: LiRNAFormula }
  | { kind: "until"; left: LiRNAFormula; right: LiRNAFormula }
  | { kind: "eventually"; formula: LiRNAFormula }
  | { kind: "at"; formula: LiRNAFormula, label: string }
  | { kind: "always"; formula: LiRNAFormula }
  | { kind: "exists"; formula: LiRNAFormula, label: string }
  | { kind: "forall"; formula: LiRNAFormula, label: string }
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
  | "DOT"
  | "EOF"
  ;

export interface Token {
  type: TokenType;
  value?: string;
  rho?: AtomicRho;
  pos: number;
}

export interface ParsedFormulaResult {
  formula: LiRNAFormula | null;
  error?: string;
}
