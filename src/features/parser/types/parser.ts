export type IndexPair = readonly [number, number];

export interface ParsedStructure {
  sequence: string;
  pairs: IndexPair[];
  thirdInput: string;
}

export type ParseField = "sequence" | "pairs" | "thirdInput";

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

export interface BatchInputStructure {
  name: string;
  sequence: string;
  pairs: string;
  formula: string;
}

export interface BatchResultEntry {
  id: string;
  name: string;
  sequence: string;
  pairs: IndexPair[];
  formula: string;
  isValid: boolean;
  errors?: string[];
  satResult?: Array<{ interval: string; constraint: string }> | null;
}

export interface BatchExportResult {
  timestamp: string;
  structureCount: number;
  results: BatchResultEntry[];
}
