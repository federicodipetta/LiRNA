import {
  buildSatContext,
  formatFormula,
  parseLtlFormula,
  parseWorkbenchInput,
  sat,
  toReadableSatSet,
  type LtlFormula,
} from "@lirna/parser";
import type {
  BatchExportResult,
  BatchInputStructure,
  BatchResultEntry,
} from "../types/parser";

export {
  parseAasContent,
  parsePairsInput,
  parseSequenceInput,
  parseWorkbenchInput,
  validateSequenceInput,
} from "@lirna/parser";

export type {
  AasImportResult,
  IndexPair,
  ParseField,
  ParseIssue,
  ParseResult,
  ParsedStructure,
} from "@lirna/parser";

export async function processBatchStructures(
  structures: BatchInputStructure[],
): Promise<BatchExportResult> {
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
        errors,
        satResult: null,
        isValid: false,
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
        errors: [...errors, `formula: ${parsedFormula.error ?? "Invalid formula"}`],
        satResult: null,
        isValid: true,
      });
      continue;
    }

    const variables = extractVariablesFromAst(parsedFormula.formula);
    const satSet = sat(
      buildSatContext(parseResult.data.sequence, parseResult.data.pairs),
      parsedFormula.formula,
    );
    const satReadable = await toReadableSatSet(
      satSet,
      variables,
      parseResult.data.pairs.length,
    );

    results.push({
      id: `structure_${index + 1}`,
      name: normalizedName,
      sequence: struct.sequence,
      pairs: parseResult.data.pairs,
      formula: formatFormula(parsedFormula.formula),
      satResult: satReadable,
      isValid: true,
    });
  }

  return {
    timestamp: new Date().toISOString(),
    structureCount: structures.length,
    results,
  };
}

function extractVariablesFromAst(formula: LtlFormula): Set<string> {
  const variables = new Set<string>();
  const variableFixed = new Set<string>();

  function traverse(node: LtlFormula): void {
    if (node.kind === "rho") {
      variables.add(node.rho.label);
    } else if (
      node.kind === "not" ||
      node.kind === "next" ||
      node.kind === "eventually" ||
      node.kind === "always"
    ) {
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
  return new Set([...variables].filter((variable) => !variableFixed.has(variable)));
}
