/**
 * Shared form field components
 */

import type { LtlFormula } from "../services/lirna-seq";

export function TextAreaField(props: {
  id: string;
  label: string;
  value: string;
  placeholder: string;
  rows?: number;
  onChange: (value: string) => void;
  error?: string;
}) {
  const { id, label, value, placeholder, rows = 5, onChange, error } = props;

  return (
    <label htmlFor={id} className="block space-y-2">
      <span className="text-sm font-semibold tracking-wide text-ink/80">{label}</span>
      <textarea
        id={id}
        rows={rows}
        value={value}
        onChange={(event) => onChange(event.currentTarget.value)}
        placeholder={placeholder}
        className="w-full resize-y rounded-2xl border border-ink/15 bg-white/80 p-4 text-sm text-ink shadow-sm outline-none transition duration-200 placeholder:text-ink/40 focus:border-sea focus:ring-2 focus:ring-sea/30"
      />
      {error ? <p className="text-sm font-medium text-coral">{error}</p> : null}
    </label>
  );
}

export function AstNodeView({ node }: { node: LtlFormula }) {
  if (node.kind === "true" || node.kind === "false") {
    return <span className="text-sea">{node.kind}</span>;
  }

  if (node.kind === "atom") {
    return <span className="text-coral">{node.value}</span>;
  }

  if (node.kind === "rho") {
    return (
      <span className="text-coral">
        {node.rho.label}
        {node.rho.kind === "up" ? "↑" : "↓"}
      </span>
    );
  }

  if (node.kind === "not" || node.kind === "next" || node.kind === "eventually") {
    const operator = node.kind === "not" ? "!" : node.kind === "next" ? "O" : "<>";

    return (
      <details open className="ml-4">
        <summary className="cursor-pointer font-semibold text-ink/80">{operator}</summary>
        <div className="mt-1 border-l border-ink/20 pl-3">
          <AstNodeView node={node.formula} />
        </div>
      </details>
    );
  }

  const operator = node.kind === "or" ? "|" : "U";

  return (
    <details open className="ml-4">
      <summary className="cursor-pointer font-semibold text-ink/80">{operator}</summary>
      <div className="mt-1 space-y-1 border-l border-ink/20 pl-3">
        <AstNodeView node={node.left} />
        <AstNodeView node={node.right} />
      </div>
    </details>
  );
}

