/**
 * Base mode input/output panel
 */

import { useMemo } from "react";
import {
  buildSatContext,
  formatFormula,
  parseLtlFormula,
  sat,
  toReadableSatSet,
  type LtlFormula,
} from "../services/ltl-sat";
import { TextAreaField, AstNodeView } from "./form-fields";

interface BaseModeProps {
  sequenceInput: string;
  setSequenceInput: (value: string) => void;
  pairsInput: string;
  setPairsInput: (value: string) => void;
  thirdInput: string;
  setThirdInput: (value: string) => void;
  parseResult: {
    data: { sequence: string; pairs: unknown[] } | null;
    issues: Array<{ field: string; message: string }>;
  };
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

  const sequenceError = parseResult.issues.find((issue) => issue.field === "sequence");
  const pairsError = parseResult.issues.find((issue) => issue.field === "pairs");

  const ltlPreview = useMemo(() => {
    if (!thirdInput.trim()) {
      return {
        syntaxError: null as string | null,
        ast: null as LtlFormula | null,
        normalized: null as string | null,
        satReadable: [] as ReturnType<typeof toReadableSatSet>,
      };
    }

    const parsedFormula = parseLtlFormula(thirdInput);
    if (!parsedFormula.formula) {
      return {
        syntaxError: parsedFormula.error ?? "Invalid formula.",
        ast: null,
        normalized: null,
        satReadable: [],
      };
    }

    const normalized = formatFormula(parsedFormula.formula);
    const satReadable = parseResult.data
      ? toReadableSatSet(
          sat(
            buildSatContext(parseResult.data.sequence, parseResult.data.pairs as unknown[]),
            parsedFormula.formula,
          ),
        )
      : [];

    return {
      syntaxError: null,
      ast: parsedFormula.formula,
      normalized,
      satReadable,
    };
  }, [thirdInput, parseResult.data]);

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
