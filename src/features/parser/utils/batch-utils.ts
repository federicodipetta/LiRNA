/**
 * Batch processing and validation utilities
 */

import { parseWorkbenchInput } from "../services/parser";
import type { BatchDraftStructure, BatchValidation } from "../types/batch";

export function createEmptyBatchStructure(index: number): BatchDraftStructure {
  return {
    id: `manual_${Date.now()}_${index}`,
    name: `molecule_${index + 1}`,
    sequence: "",
    pairs: "",
    isLocked: false,
  };
}

export function getAasBaseName(fileName: string): string {
  return fileName.replace(/\.aas$/i, "");
}

export function computeBatchValidation(
  structures: BatchDraftStructure[],
  formulaInput: string,
  formulaError: string | null,
): Record<string, BatchValidation> {
  const next: Record<string, BatchValidation> = {};

  for (const row of structures) {
    const hasContent = row.sequence.trim().length > 0 || row.pairs.trim().length > 0;
    if (!hasContent) {
      next[row.id] = {
        hasContent: false,
        isValidCandidate: false,
        issues: [],
      };
      continue;
    }

    const parsed = parseWorkbenchInput(row.sequence, row.pairs, formulaInput);
    next[row.id] = {
      hasContent: true,
      isValidCandidate: parsed.data !== null && !formulaError,
      issues: parsed.issues.map((issue) => issue.message),
    };
  }

  return next;
}

export function getStatusBadge(hasContent: boolean, isValid: boolean | null, isValidCandidate: boolean) {
  if (!hasContent) {
    return { label: "to process", class: "bg-ink/10 text-ink/70" };
  }

  if (isValid !== null) {
    if (isValid) {
      return { label: "processed", class: "bg-sea/15 text-sea" };
    } else {
      return { label: "invalid", class: "bg-coral/15 text-coral" };
    }
  }

  if (isValidCandidate) {
    return { label: "ready", class: "bg-amber-200/60 text-amber-700" };
  }

  return { label: "invalid", class: "bg-coral/15 text-coral" };
}
