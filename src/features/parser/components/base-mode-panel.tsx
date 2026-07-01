/**
 * Base mode input/output panel
 */

import { useEffect, useState } from "react";
import {
  formatFormula,
  parseLtlFormula,
  type LtlFormula,
} from "../services/lirna-seq";
import { sat, buildSatContext, toReadableSatSet } from "../services/lirna-seq/evaluetor-full";
import type { ReadableSatEntry, ReadableSubstitution } from "../services/lirna-seq/evaluetor-full";
import type { ParseResult } from "../types/parser";
import { TextAreaField, AstNodeView } from "./form-fields";
import { init } from "z3-solver";
import { Z3Wrapper } from "../services/lirna-seq/z3Wrapper";

interface BaseModeProps {
  sequenceInput: string;
  setSequenceInput: (value: string) => void;
  pairsInput: string;
  setPairsInput: (value: string) => void;
  thirdInput: string;
  setThirdInput: (value: string) => void;
  parseResult: ParseResult;
}

export function BaseModePanel(props: BaseModeProps) {
  const {
    sequenceInput,
    setSequenceInput,
    pairsInput,
    setPairsInput,
    thirdInput,
    setThirdInput,
    parseResult,
  } = props;
  const [z3Ready, setZ3Ready] = useState(false);
  useEffect(() => {
    init().then(() => setZ3Ready(true)); // o come inizializzi Z3
  }, []);

  const sequenceError = parseResult.issues.find((issue) => issue.field === "sequence");
  const pairsError = parseResult.issues.find((issue) => issue.field === "pairs");
  const [ltlPreview, setLtlPreview] = useState<{
    syntaxError: string | null;
    ast: LtlFormula | null;
    normalized: string | null;
    satReadable: Awaited<ReturnType<typeof toReadableSatSet>>;
  }>({
    syntaxError: null,
    ast: null,
    normalized: null,
    satReadable: [],
  });
    
    useEffect(() => {
      if (!z3Ready) return;
      if (!thirdInput.trim()) {
        setLtlPreview({
          syntaxError: null,
          ast: null,
          normalized: null,
          satReadable: [],
        });
        return;
      }

      const parsedFormula = parseLtlFormula(thirdInput);
      if (!parsedFormula.formula) {
        setLtlPreview({
          syntaxError: parsedFormula.error ?? "Invalid formula.",
          ast: null,
          normalized: null,
          satReadable: [],
        });
        return;
      }

      const normalized = formatFormula(parsedFormula.formula);
      const variables = extractVariablesFromAst(parsedFormula.formula);
      const maxDomain = parseResult.data?.pairs.length ?? 0;
      
      const compute = async () => {

        const satSet = parseResult.data
          ? sat(
              buildSatContext(parseResult.data.sequence, parseResult.data.pairs),
              parsedFormula.formula!,
            )
          : [];
        const sharedWrapper = new Z3Wrapper(maxDomain, variables);
        let satReadable : ReadableSatEntry[] = [];
        try{
           satReadable = parseResult.data
            ? await toReadableSatSet(satSet, variables, maxDomain, sharedWrapper)
            : [];
        } catch(e) {
          console.error("Error computing SAT set:", e);
        }


        setLtlPreview({
          syntaxError: null,
          ast: parsedFormula.formula,
          normalized,
          satReadable,
        });
      };

      compute();
  }, [thirdInput, parseResult.data, z3Ready]);
  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <article className="glass-card space-y-4 rounded-3xl p-5 shadow-glow sm:p-6">
        <TextAreaField
          id="sequence-input"
          label="RNA sequence (A, C, G, U only)"
          value={sequenceInput}
          onChange={setSequenceInput}
          rows={4}
          placeholder="Example: ACGUACGU"
          error={sequenceError?.message}
        />

        <TextAreaField
          id="pairs-input"
          label="bonds"
          value={pairsInput}
          onChange={setPairsInput}
          rows={6}
          placeholder="Example: (0,1);(2,3);(4,7)"
          error={pairsError?.message}
        />

        <TextAreaField
          id="third-input"
          label="LTL formula (use !, O, <>, U, |, atoms A/C/G/U and l↑/l↓)"
          value={thirdInput}
          onChange={setThirdInput}
          rows={5}
          placeholder="Example: <>(l↑ U O(l↓ | true)) or A"
          error={ltlPreview.syntaxError ?? undefined}
        />
      </article>

      <article className="glass-card rounded-3xl p-5 shadow-glow sm:p-6">
        <div className="mb-4 flex flex-wrap gap-2 text-xs font-semibold uppercase tracking-wide">
          <span className="rounded-full bg-sea/15 px-3 py-1 text-sea">
            seq len: {parseResult.data?.sequence.length ?? 0}
          </span>
          <span className="rounded-full bg-coral/15 px-3 py-1 text-coral">
            pairs: {parseResult.data?.pairs.length ?? 0}
          </span>
          <span className="rounded-full bg-ink/10 px-3 py-1 text-ink/70">
            status: {parseResult.data ? "valid" : "needs correction"}
          </span>
        </div>

        <h2 className="mb-3 text-sm font-semibold uppercase tracking-[0.2em] text-ink/70">Parser output</h2>

        <pre className="max-h-[28rem] overflow-auto rounded-2xl border border-ink/15 bg-ink p-4 text-xs leading-relaxed text-mist sm:text-sm">
          {JSON.stringify(
            parseResult.data ?? {
              errors: parseResult.issues,
            },
            null,
            2,
          )}
        </pre>

        <h2 className="mb-3 mt-6 text-sm font-semibold uppercase tracking-[0.2em] text-ink/70">AST LTL</h2>
        <div className="rounded-2xl border border-ink/15 bg-white/70 p-4 text-sm text-ink">
          {ltlPreview.ast ? (
            <>
              <p className="mb-2 text-xs text-ink/60">Normalized formula: {ltlPreview.normalized}</p>
              <AstNodeView node={ltlPreview.ast} />
            </>
          ) : (
            <p className="text-ink/60">Enter a valid formula to display the syntax tree.</p>
          )}
        </div>

        <h2 className="mb-3 mt-6 text-sm font-semibold uppercase tracking-[0.2em] text-ink/70">Readable SAT</h2>
        <pre className="max-h-56 overflow-auto rounded-2xl border border-ink/15 bg-ink p-4 text-xs leading-relaxed text-mist sm:text-sm">
          {JSON.stringify(ltlPreview.satReadable, null, 2)}
        </pre>
      </article>
    </div>
  );
}

function extractVariablesFromAst(formula: LtlFormula) : Set<string> {
  const variables = new Set<string>();
  const variableFixed = new Set<string>();
  function traverse(node: LtlFormula) {
    if (node.kind === "rho") {
      variables.add(node.rho.label);
    } else if (node.kind === "not" || node.kind === "next" || node.kind === "eventually" || node.kind === "always") {
      traverse(node.formula);
    } else if (node.kind === "or" || node.kind === "and" || node.kind === "until") {
      traverse(node.left);
      traverse(node.right);
    } else if (node.kind === "exists" || node.kind === "forall") {
      variableFixed.add(node.label);
      traverse(node.formula);
    } else if (node.kind === "at") {
      variables.add(node.label);
      traverse(node.formula);
    }
  }
  traverse(formula);
  return new Set([...variables].filter((v) => !variableFixed.has(v)));
}

