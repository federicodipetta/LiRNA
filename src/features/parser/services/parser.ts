import type {
  AasImportResult,
  BatchExportResult,
  BatchInputStructure,
  BatchResultEntry,
  IndexPair,
  ParseIssue,
  ParseResult,
  ParsedStructure,
} from "../types/parser";
import {
  buildSatContext,
  formatFormula,
  LtlFormula,
  parseLtlFormula,
  sat,
  toReadableSatSet,
} from "./lirna-seq";

const pairRegex = /\(\s*(-?\d+)\s*,\s*(-?\d+)\s*\)/g;

export function parseSequenceInput(rawSequence: string): string {
  return rawSequence.replace(/\s+/g, "").trim().toUpperCase();
}

export function validateSequenceInput(sequence: string): string | null {
  if (sequence.length === 0) {
    return "Enter a valid sequence.";
  }

  if (!/^[ACGU]+$/.test(sequence)) {
    return "The sequence may contain only A, C, G, and U.";
  }

  return null;
}

export function parsePairsInput(rawPairs: string): { pairs: IndexPair[]; issue?: string } {
  const trimmed = rawPairs.trim();

  if (!trimmed) {
    return { pairs: [] };
  }

  const matches = [...trimmed.matchAll(pairRegex)];

  if (matches.length === 0) {
    return {
      pairs: [],
      issue: "Invalid format. Use for example: (0,1);(1,2);(11,31)",
    };
  }

  const pairs: IndexPair[] = matches.map((match) => [Number(match[1]), Number(match[2])]);

  const leftovers = trimmed.replace(pairRegex, "").replace(/[;\s]+/g, "");

  if (leftovers.length > 0) {
    return {
      pairs: [],
      issue: "There are unrecognized characters in the pair list.",
    };
  }

  return { pairs };
}

export function parseWorkbenchInput(
  rawSequence: string,
  rawPairs: string,
  rawThirdInput: string,
): ParseResult {
  const issues: ParseIssue[] = [];

  const sequence = parseSequenceInput(rawSequence);
  const sequenceIssue = validateSequenceInput(sequence);
  if (sequenceIssue) {
    issues.push({
      field: "sequence",
      message: sequenceIssue,
    });
  }

  const { pairs, issue } = parsePairsInput(rawPairs);
  if (issue) {
    issues.push({
      field: "pairs",
      message: issue,
    });
  }

  if (!issue && sequence.length > 0) {
    const invalidPair = pairs.find(
      ([left, right]) =>
        left < 0 ||
        right < 0 ||
        left >= sequence.length ||
        right >= sequence.length,
    );

    if (invalidPair) {
      issues.push({
        field: "pairs",
        message: `Pairs must have indices between 0 and ${sequence.length - 1}. Invalid pair found: (${invalidPair[0]},${invalidPair[1]}).`,
      });
    }
  }

  if (issues.length > 0) {
    return { data: null, issues };
  }

  const data: ParsedStructure = {
    sequence,
    pairs,
    thirdInput: rawThirdInput,
  };

  return { data, issues: [] };
}

export function parseAasContent(rawFileContent: string): AasImportResult {
  const lines = rawFileContent
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  if (lines.length < 2) {
    return {
      sequence: "",
      pairsInput: "",
      issue: "Invalid .aas format. Expected: first line sequence, second line pair list.",
    };
  }

  const sequence = parseSequenceInput(lines[0]);
  const pairsInput = lines.slice(1).join("");

  if (!sequence || !pairsInput) {
    return {
      sequence: "",
      pairsInput: "",
      issue: "The .aas file must contain both a sequence and a pair list.",
    };
  }

  return {
    sequence,
    pairsInput,
  };
}

export async function processBatchStructures(structures: BatchInputStructure[]): Promise<BatchExportResult> {
  const results: BatchResultEntry[] = [];
  for (const [index, struct] of structures.entries()) {
    const parseResult = parseWorkbenchInput(struct.sequence, struct.pairs, struct.formula);
    const errors = parseResult.issues.map((issue) => `${issue.field}: ${issue.message}`);
    const normalizedName = struct.name.trim() || `structure_${index + 1}`;

    if (!parseResult.data) {
      results.push({
        id: `structure_${index + 1}`,
        name: normalizedName,
        sequence: struct.sequence,
        pairs: [],
        formula: struct.formula,
        isValid: false,
        errors,
        satResult: null,
      });
      continue;
    }

    const parsedFormula = parseLtlFormula(struct.formula);
    if (!parsedFormula.formula) {
      results.push({ 
        id: `structure_${index + 1}`,
        name: normalizedName,
        sequence: struct.sequence,
        pairs: parseResult.data.pairs,
        formula: struct.formula,
        isValid: false,
        errors: [...errors, `formula: ${parsedFormula.error ?? "Invalid formula"}`],
        satResult: null,
      });
      continue;
    }

    
    const variables = extractVariablesFromAst(parsedFormula.formula);
    const maxDomain = parseResult.data?.pairs.length ?? 0; 
    const satSet = parseResult.data ? sat(
      buildSatContext(parseResult.data.sequence, parseResult.data.pairs),
      parsedFormula.formula
    ) : [];

    const satReadable = parseResult.data 
      ? await toReadableSatSet(satSet, variables, maxDomain) 
      : [];


    results.push({
      id: `structure_${index + 1}`,
      name: normalizedName,
      sequence: struct.sequence,
      pairs: parseResult.data.pairs,
      formula: formatFormula(parsedFormula.formula),
      isValid: true,
      satResult: satReadable,
    });
  };

  return {
    timestamp: new Date().toISOString(),
    structureCount: structures.length,
    results,
  };
}


function extractVariablesFromAst(formula: LtlFormula) : Set<string> {
  const variables = new Set<string>();
  const variableFixed = new Set<string>();
  function traverse(node: LtlFormula) {
    if (node.kind === "rho") {
      variables.add(node.rho.label);
    } else if (node.kind === "not" || node.kind === "next" || node.kind === "eventually" || node.kind === "always") {
      traverse(node.formula);
    } else if (node.kind === "or" || node.kind === "and" || node.kind === "until") {
      traverse(node.left);
      traverse(node.right);
    } else if (node.kind === "exists" || node.kind === "forall") {
      variableFixed.add(node.label);
      traverse(node.formula);
    } else if (node.kind === "at") {
      variables.add(node.label);
      traverse(node.formula);
    }
  }
  traverse(formula);
  return new Set([...variables].filter((v) => !variableFixed.has(v)));
}