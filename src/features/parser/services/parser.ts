import type {
  AasImportResult,
  IndexPair,
  ParseIssue,
  ParseResult,
  ParsedStructure,
} from "../types/parser";

const pairRegex = /\(\s*(-?\d+)\s*,\s*(-?\d+)\s*\)/g;

export function parseSequenceInput(rawSequence: string): string {
  return rawSequence.replace(/\s+/g, "").trim();
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
      issue: "Formato non valido. Usa ad esempio: (1,2);(2,3);(12,32)",
    };
  }

  const pairs: IndexPair[] = matches.map((match) => [Number(match[1]), Number(match[2])]);

  const leftovers = trimmed.replace(pairRegex, "").replace(/[;\s]+/g, "");

  if (leftovers.length > 0) {
    return {
      pairs: [],
      issue: "Ci sono caratteri non riconosciuti nella lista delle coppie.",
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
  if (sequence.length === 0) {
    issues.push({
      field: "sequence",
      message: "Inserisci una sequenza valida.",
    });
  }

  const { pairs, issue } = parsePairsInput(rawPairs);
  if (issue) {
    issues.push({
      field: "pairs",
      message: issue,
    });
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
      issue: "Formato .aas non valido. Atteso: prima riga sequenza, seconda riga lista coppie.",
    };
  }

  const sequence = parseSequenceInput(lines[0]);
  const pairsInput = lines.slice(1).join("");

  if (!sequence || !pairsInput) {
    return {
      sequence: "",
      pairsInput: "",
      issue: "Il file .aas deve contenere sia sequenza sia lista di coppie.",
    };
  }

  return {
    sequence,
    pairsInput,
  };
}
