import type { LtlFormula, ParsedFormulaResult, Token, TokenType } from "./ast";
import { tokenizeFormula } from "./lexer";

class FormulaParser {
  private readonly tokens: Token[];

  private cursor = 0;

  constructor(tokens: Token[]) {
    this.tokens = tokens;
  }

  parse(): LtlFormula {
    const expression = this.parseUntil();
    this.expect("EOF");
    return expression;
  }

  private parseUntil(): LtlFormula {
    let left = this.parseOr();

    while (this.peek().type === "UNTIL") {
      this.advance();
      const right = this.parseUntil();
      left = { kind: "until", left, right };
    }

    return left;
  }

  private parseOr(): LtlFormula {
    let left = this.parseUnary();

    while (this.peek().type === "OR") {
      this.advance();
      const right = this.parseUnary();
      left = { kind: "or", left, right };
    }

    return left;
  }

  private parseUnary(): LtlFormula {
    const token = this.peek();

    if (token.type === "NOT") {
      this.advance();
      return { kind: "not", formula: this.parseUnary() };
    }

    if (token.type === "NEXT") {
      this.advance();
      return { kind: "next", formula: this.parseUnary() };
    }

    if (token.type === "EVENTUALLY") {
      this.advance();
      return { kind: "eventually", formula: this.parseUnary() };
    }

    return this.parsePrimary();
  }

  private parsePrimary(): LtlFormula {
    const token = this.peek();

    if (token.type === "TRUE") {
      this.advance();
      return { kind: "true" };
    }

    if (token.type === "FALSE") {
      this.advance();
      return { kind: "false" };
    }

    if (token.type === "ATOM" && token.value) {
      this.advance();
      return { kind: "atom", value: token.value };
    }

    if (token.type === "RHO" && token.rho) {
      this.advance();
      return { kind: "rho", rho: token.rho };
    }

    if (token.type === "LPAREN") {
      this.advance();
      const expr = this.parseUntil();
      this.expect("RPAREN");
      return expr;
    }

    throw new Error(`Invalid formula near position ${token.pos + 1}`);
  }

  private expect(type: TokenType): Token {
    const token = this.peek();
    if (token.type !== type) {
      throw new Error(`Expected ${type}, found ${token.type} at position ${token.pos + 1}`);
    }
    return this.advance();
  }

  private peek(): Token {
    return this.tokens[this.cursor];
  }

  private advance(): Token {
    const token = this.tokens[this.cursor];
    this.cursor += 1;
    return token;
  }
}

export function parseLtlFormula(input: string): ParsedFormulaResult {
  const source = input.trim();
  if (!source) {
    return {
      formula: null,
      error: "Enter an LTL formula.",
    };
  }

  try {
    const tokens = tokenizeFormula(source);
    const parser = new FormulaParser(tokens);
    return {
      formula: parser.parse(),
    };
  } catch (error) {
    return {
      formula: null,
      error: error instanceof Error ? error.message : "Unknown error while parsing LTL.",
    };
  }
}
