import type {
  AasImportResult,
  IndexPair,
  ParseIssue,
  ParseResult,
  ParsedStructure,
} from "../types/parser";

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
    // IS 0-BASED
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
