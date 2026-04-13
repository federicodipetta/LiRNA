export type IndexPair = readonly [number, number];

export interface ParsedStructure {
  sequence: string;
  pairs: IndexPair[];
  thirdInput: string;
}

export type ParseField = "sequence" | "pairs";

export interface ParseIssue {
  field: ParseField;
  message: string;
}

export interface ParseResult {
  data: ParsedStructure | null;
  issues: ParseIssue[];
}

export interface AasImportResult {
  sequence: string;
  pairsInput: string;
  issue?: string;
}
