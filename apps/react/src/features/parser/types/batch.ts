/**
 * Centralized types for batch workbench
 */

export type WorkbenchMode = "base" | "batch";

export type BatchDraftStructure = {
  id: string;
  name: string;
  sequence: string;
  pairs: string;
  isLocked: boolean;
};

export type BatchValidation = {
  hasContent: boolean;
  isValidCandidate: boolean;
  issues: string[];
};
