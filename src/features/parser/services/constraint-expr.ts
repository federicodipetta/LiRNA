export type ConstraintValue = string | number | boolean;

export type ConstraintAssignment = Record<string, ConstraintValue>;

export type ConstraintExpr =
  | { kind: "true", simplified?: boolean }
  | { kind: "false", simplified?: boolean }
  | { kind: "atom"; simplified?: boolean; label: string; value: ConstraintValue }
  | { kind: "not"; simplified?: boolean; expr: ConstraintExpr }
  | { kind: "and"; simplified?: boolean; left: ConstraintExpr; right: ConstraintExpr }
  | { kind: "or"; simplified?: boolean; left: ConstraintExpr; right: ConstraintExpr };

export const TRUE: ConstraintExpr = { kind: "true", simplified: true };
export const FALSE: ConstraintExpr = { kind: "false", simplified: true};

export function eqConstraint(label: string, value: ConstraintValue): ConstraintExpr {
  return { kind: "atom", label, value };
}

function serializeConstraint(expr: ConstraintExpr): string {
  switch (expr.kind) {
    case "true":
      return "TRUE";
    case "false":
      return "FALSE";
    case "atom":
      return `ATOM(${expr.label}=${String(expr.value)})`;
    case "not":
      return `NOT(${serializeConstraint(expr.expr)})`;
    case "and":
      return `AND(${serializeConstraint(expr.left)},${serializeConstraint(expr.right)})`;
    case "or":
      return `OR(${serializeConstraint(expr.left)},${serializeConstraint(expr.right)})`;
  }
}

export function isEqualConstraint(a: ConstraintExpr, b: ConstraintExpr): boolean {
  return serializeConstraint(a) === serializeConstraint(b);
}

function isNegationPair(left: ConstraintExpr, right: ConstraintExpr): boolean {
  return (
    (left.kind === "not" && isEqualConstraint(left.expr, right)) ||
    (right.kind === "not" && isEqualConstraint(right.expr, left))
  );
}

export function simplifyConstraint(expr: ConstraintExpr): ConstraintExpr {
  if (expr.simplified === true) {
    return expr;
  }
  expr.simplified = true;
  switch (expr.kind) {
    case "true":
    case "false":
    case "atom":
      return expr;
    case "not": {
      const inner = simplifyConstraint(expr.expr);

      if (inner.kind === "true") {
        return FALSE;
      }

      if (inner.kind === "false") {
        return TRUE;
      }

      if (inner.kind === "not") {
        return simplifyConstraint(inner.expr);
      }

      return { kind: "not", expr: inner, simplified: true };
    }
    case "and": {
      const left = simplifyConstraint(expr.left);
      const right = simplifyConstraint(expr.right);

      if (left.kind === "false" || right.kind === "false") {
        return FALSE;
      }

      if (left.kind === "true") {
        return right;
      }

      if (right.kind === "true") {
        return left;
      }

      if (isEqualConstraint(left, right)) {
        return left;
      }

      if (isNegationPair(left, right)) {
        return FALSE;
      }

      if (left.kind === "atom" && right.kind === "atom" && left.label === right.label) {
        return left.value === right.value ? left : FALSE;
      }

      return { kind: "and", left, right, simplified: true };
    }
    case "or": {
      const left = simplifyConstraint(expr.left);
      const right = simplifyConstraint(expr.right);

      if (left.kind === "true" || right.kind === "true") {
        return TRUE;
      }

      if (left.kind === "false") {
        return right;
      }

      if (right.kind === "false") {
        return left;
      }

      if (isEqualConstraint(left, right)) {
        return left;
      }

      return { kind: "or", left, right, simplified: true };
    }
  }
}

export function negateConstraint(expr: ConstraintExpr): ConstraintExpr {
  return simplifyConstraint({ kind: "not", expr, simplified: false });
}

export function andConstraint(left: ConstraintExpr, right: ConstraintExpr): ConstraintExpr {
  return simplifyConstraint({ kind: "and", left, right, simplified: false });
}

export function orConstraint(left: ConstraintExpr, right: ConstraintExpr): ConstraintExpr {
  return simplifyConstraint({ kind: "or", left, right, simplified: false });
}

export function evaluateConstraint(
  expr: ConstraintExpr,
  assignment: ConstraintAssignment,
): boolean | undefined {
  switch (expr.kind) {
    case "true":
      return true;
    case "false":
      return false;
    case "atom": {
      const value = assignment[expr.label];
      return value === undefined ? undefined : value === expr.value;
    }
    case "not": {
      const evaluated = evaluateConstraint(expr.expr, assignment);
      return evaluated === undefined ? undefined : !evaluated;
    }
    case "and": {
      const left = evaluateConstraint(expr.left, assignment);
      const right = evaluateConstraint(expr.right, assignment);

      if (left === false || right === false) {
        return false;
      }

      if (left === true && right === true) {
        return true;
      }

      return undefined;
    }
    case "or": {
      const left = evaluateConstraint(expr.left, assignment);
      const right = evaluateConstraint(expr.right, assignment);

      if (left === true || right === true) {
        return true;
      }

      if (left === false && right === false) {
        return false;
      }

      return undefined;
    }
  }
}

export function formatConstraint(expr: ConstraintExpr): string {
  switch (expr.kind) {
    case "true":
      return "true";
    case "false":
      return "false";
    case "atom":
      return `${expr.label} = ${String(expr.value)}`;
    case "not":
      return `!(${formatConstraint(expr.expr)})`;
    case "and":
      return `(${formatConstraint(expr.left)} && ${formatConstraint(expr.right)})`;
    case "or":
      return `(${formatConstraint(expr.left)} || ${formatConstraint(expr.right)})`;
  }
}
