export function normalizeSequence(rawSequence: string): string {
  return rawSequence.replace(/\s+/g, "").trim().toUpperCase();
}

export function validateSequence(sequence: string): string | null {
  if (sequence.length === 0) {
    return "Enter a valid sequence.";
  }

  if (!/^[ACGU]+$/.test(sequence)) {
    return "The sequence may contain only A, C, G, and U.";
  }

  return null;
}

export function parseSequence(rawSequence: string): {
  sequence: string;
  issue?: string;
} {
  const sequence = normalizeSequence(rawSequence);
  const issue = validateSequence(sequence);

  return issue ? { sequence, issue } : { sequence };
}
