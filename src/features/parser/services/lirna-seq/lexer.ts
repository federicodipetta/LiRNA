import type { AtomicRho, Token } from "./ast";

function readQuotedAtom(source: string, start: number): { value: string; end: number } {
  const quote = source[start];
  const endQuote = source.indexOf(quote, start + 1);

  if (endQuote === -1) {
    throw new Error(`Unterminated quoted atom at position ${start + 1}`);
  }

  const value = source.slice(start + 1, endQuote).trim();
  if (!/^[ACGU]$/.test(value)) {
    throw new Error(`Invalid atom '${value}' at position ${start + 1}`);
  }

  return { value, end: endQuote + 1 };
}

function isIdentifierStart(ch: string): boolean {
  return /[A-Za-z_]/.test(ch);
}

function isIdentifierChar(ch: string): boolean {
  return /[A-Za-z0-9_]/.test(ch);
}

function skipSpaces(source: string, start: number): number {
  let i = start;
  while (i < source.length && /\s/.test(source[i])) {
    i += 1;
  }
  return i;
}

function readIdentifier(source: string, start: number): { ident: string; end: number } {
  let end = start;
  while (end < source.length && isIdentifierChar(source[end])) {
    end += 1;
  }
  return {
    ident: source.slice(start, end),
    end,
  };
}

function readRhoDirection(
  source: string,
  from: number,
): { direction: AtomicRho["kind"] | null; end: number } {
  const i = skipSpaces(source, from);

  if (source[i] === ">") {
    return { direction: "up", end: i + 1 };
  }

  if (source[i] === "<") {
    return { direction: "down", end: i + 1 };
  }

  if (source.startsWith("\\uparrow", i) || source.startsWith("\\updattow", i)) {
    return {
      direction: "up",
      end: source.startsWith("\\updattow", i) ? i + 9 : i + 8,
    };
  }

  if (source.startsWith("\\downarrow", i)) {
    return { direction: "down", end: i + 10 };
  }

  if (source.startsWith("up", i)) {
    return { direction: "up", end: i + 2 };
  }

  if (source.startsWith("down", i)) {
    return { direction: "down", end: i + 4 };
  }

  if (source[i] === "↑") {
    return { direction: "up", end: i + 1 };
  }

  if (source[i] === "↓") {
    return { direction: "down", end: i + 1 };
  }

  return { direction: null, end: i };
}

export function tokenizeFormula(source: string): Token[] {
  const tokens: Token[] = [];
  let i = 0;

  while (i < source.length) {
    i = skipSpaces(source, i);
    if (i >= source.length) {
      break;
    }

    const ch = source[i];

    if (ch === "'" || ch === '"') {
      const { value, end } = readQuotedAtom(source, i);
      tokens.push({ type: "ATOM", value, pos: i });
      i = end;
      continue;
    }

    if (source.startsWith("<>", i)) {
      tokens.push({ type: "EVENTUALLY", pos: i });
      i += 2;
      continue;
    }

    if (source.startsWith("[]", i)) {
      tokens.push({ type: "ALWAYS", pos: i });
      i += 2;
      continue;
    }

    if (source.startsWith("|>", i)) {
      tokens.push({ type: "PIPE_IMPL", pos: i });
      i += 2;
      continue;
    }

    if (source.startsWith("&&", i)) {
      tokens.push({ type: "AND", pos: i });
      i += 2;
      continue;
    }

    if (ch === "&") {
      tokens.push({ type: "AND", pos: i });
      i += 1;
      continue;
    }

    if (source.startsWith("||", i)) {
      tokens.push({ type: "OR", pos: i });
      i += 2;
      continue;
    }

    if (ch === "|") {
      tokens.push({ type: "OR", pos: i });
      i += 1;
      continue;
    }

    if (ch === "!") {
      tokens.push({ type: "NOT", pos: i });
      i += 1;
      continue;
    }

    if (ch === "(") {
      tokens.push({ type: "LPAREN", pos: i });
      i += 1;
      continue;
    }

    if (ch === ")") {
      tokens.push({ type: "RPAREN", pos: i });
      i += 1;
      continue;
    }

    if (ch === "U") {
      tokens.push({ type: "UNTIL", pos: i });
      i += 1;
      continue;
    }

    if (ch === "O") {
      tokens.push({ type: "NEXT", pos: i });
      i += 1;
      continue;
    }

    if (isIdentifierStart(ch)) {
      const { ident, end } = readIdentifier(source, i);

      if (ident === "true") {
        tokens.push({ type: "TRUE", pos: i });
        i = end;
        continue;
      }

      if (ident === "false") {
        tokens.push({ type: "FALSE", pos: i });
        i = end;
        continue;
      }

      if (/^[ACGU]$/.test(ident)) {
        tokens.push({ type: "ATOM", value: ident, pos: i });
        i = end;
        continue;
      }

      if (ident.toLowerCase() === "or") {
        tokens.push({ type: "OR", pos: i });
        i = end;
        continue;
      }

      if (ident.toLowerCase() === "and") {
        tokens.push({ type: "AND", pos: i });
        i = end;
        continue;
      }

      if (ident.toLowerCase() === "always") {
        tokens.push({ type: "ALWAYS", pos: i });
        i = end;
        continue;
      }

      const direction = readRhoDirection(source, end);
      if (direction.direction) {
        tokens.push({
          type: "RHO",
          pos: i,
          rho: { kind: direction.direction, label: ident },
        });
        i = direction.end;
        continue;
      }

      tokens.push({ type: "LABEL", value: ident, pos: i });
      i = end;
      continue;
    }

    throw new Error(`Invalid token at position ${i + 1}`);
  }

  tokens.push({ type: "EOF", pos: source.length });
  return tokens;
}
