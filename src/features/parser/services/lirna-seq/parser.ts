import type { LtlFormula, ParsedFormulaResult, Token, TokenType } from "./ast";
import { tokenizeFormula } from "./lexer";

class FormulaParser {
  private readonly tokens: Token[];

  private cursor = 0;

  constructor(tokens: Token[]) {
    this.tokens = tokens;
  }

  parse(): LtlFormula {
    const expression = this.parseAt();
    this.expect("EOF");
    return expression;
  }

  private parsePipeImpl(): LtlFormula {
    let left = this.parseUntil();

    while (this.peek().type === "PIPE_IMPL") {
      this.advance();
      const labelToken = this.expect("LABEL");
      const label = labelToken.value;

      if (!label) {
        throw new Error(`Expected label after |>, found empty token at position ${labelToken.pos + 1}`);
      }

      left = {
        kind: "eventually",
        formula: {
          kind: "and",
          left: {
            kind: "rho",
            rho: {
              kind: "down",
              label,
            },
          },
          right: {
            kind: "next",
            formula: left,
          },
        },
      };
    }

    return left;
  }

  private parseAt(): LtlFormula {
    let left = this.parsePipeImpl();
    
    while (this.peek().type === "AT") {
      this.advance();
      const labelToken = this.expect("LABEL");
      left = {
        kind: "at",
        formula: left,
        label: labelToken.value || "",
      } as LtlFormula;
      
    }

    return left;
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
    let left = this.parseAnd();

    while (this.peek().type === "OR") {
      this.advance();
      const right = this.parseAnd();
      left = { kind: "or", left, right };
    }

    return left;
  }

  private parseAnd(): LtlFormula {
    let left = this.parseUnary();

    while (this.peek().type === "AND") {
      this.advance();
      const right = this.parseUnary();
      left = { kind: "and", left, right };
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

    if (token.type === "ALWAYS") {
      this.advance();
      return { kind: "always", formula: this.parseUnary() };
    }

    if (token.type === "EXISTS") {
      this.advance();
      if (!token.value) {
        throw new Error(`Expected label after 'exists', found empty token at position ${token.pos + 1}`);
      }
      return { kind: "exists", formula: this.parseUnary(), label: token.value || "" };
    }

    if (token.type === "FORALL") {
      this.advance();
      if (!token.value) {
        throw new Error(`Expected label after 'forall', found empty token at position ${token.pos + 1}`);
      }
      return { kind: "forall", formula: this.parseUnary(), label: token.value || "" };
    }

    return this.parseParen(); // ← invece di parsePrimary
  }

  // Nuovo metodo: se c'è una parentesi, ricomincia dall'inizio della gerarchia.
  // Altrimenti, vai ai letterali (atom, true, false, rho).
  private parseParen(): LtlFormula {
    const token = this.peek();

    if (token.type === "LPAREN") {
      this.advance();
      const expr = this.parseExpression(); 
      this.expect("RPAREN");
      return expr;
    }

    return this.parsePrimary(); // nessuna parentesi → letterali
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
  /**Return the top-level formula */
  private parseExpression(): LtlFormula {
    return this.parseAt();
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
