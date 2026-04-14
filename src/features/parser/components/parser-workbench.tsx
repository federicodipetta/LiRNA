import { useMemo, useRef, useState } from "react";
import { useParserForm } from "../hooks/useParserForm";
import {
  buildSatContext,
  formatFormula,
  parseLtlFormula,
  sat,
  toReadableSatSet,
  type LtlFormula,
} from "../services/ltl-sat";
import { parseAasContent } from "../services/parser";

function TextAreaField(props: {
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

function AstNodeView({ node }: { node: LtlFormula }) {
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

export function ParserWorkbench() {
  const {
    sequenceInput,
    setSequenceInput,
    pairsInput,
    setPairsInput,
    thirdInput,
    setThirdInput,
    parseResult,
  } = useParserForm();
  const [importIssue, setImportIssue] = useState<string | null>(null);
  const [isDragOver, setIsDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

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
            buildSatContext(parseResult.data.sequence, parseResult.data.pairs),
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

  async function importAasFile(file: File) {
    if (!file.name.toLowerCase().endsWith(".aas")) {
      setImportIssue("Select a valid .aas file.");
      return;
    }

    const content = await file.text();
    const parsedImport = parseAasContent(content);

    if (parsedImport.issue) {
      setImportIssue(parsedImport.issue);
      return;
    }

    setImportIssue(null);
    setSequenceInput(parsedImport.sequence);
    setPairsInput(parsedImport.pairsInput);
  }

  return (
    <section className="mx-auto max-w-6xl animate-drift space-y-6">
      <header className="space-y-3 text-center">
        <h1 className="text-balance text-3xl font-bold tracking-tight text-ink sm:text-5xl">
          LiRNA Workbench
        </h1>
        <p className="mx-auto max-w-2xl text-sm text-ink/80 sm:text-base">
          Insert a sequence and a list of pairs to see the parsed structure. You can also import a .aas file.
        </p>
      </header>

      <div className="grid gap-6 lg:grid-cols-2">
        <article className="glass-card space-y-4 rounded-3xl p-5 shadow-glow sm:p-6">
          <div
            onDragOver={(event) => {
              event.preventDefault();
              setIsDragOver(true);
            }}
            onDragLeave={() => setIsDragOver(false)}
            onDrop={async (event) => {
              event.preventDefault();
              setIsDragOver(false);

              const file = event.dataTransfer.files[0];
              if (file) {
                await importAasFile(file);
              }
            }}
            className={`rounded-2xl border border-dashed p-4 transition ${
              isDragOver ? "border-sea bg-sea/10" : "border-ink/20 bg-white/60"
            }`}
          >
            <p className="text-sm font-medium text-ink/80">Import .aas</p>
            <p className="text-xs text-ink/65">Drag the file here or use the button.</p>
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="rounded-xl bg-ink px-3 py-2 text-xs font-semibold uppercase tracking-wide text-mist transition hover:bg-ink/85"
              >
                Upload .aas file
              </button>
              <span className="text-xs text-ink/60">Format: sequence on line 1, pairs on line 2</span>
            </div>
            <input
              ref={fileInputRef}
              type="file"
              accept=".aas,text/plain"
              className="hidden"
              onChange={async (event) => {
                const file = event.currentTarget.files?.[0];
                if (file) {
                  await importAasFile(file);
                }
                event.currentTarget.value = "";
              }}
            />
            {importIssue ? <p className="mt-2 text-sm font-medium text-coral">{importIssue}</p> : null}
          </div>

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
            placeholder="Esempio: (0,1);(2,3);(4,7)"
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
          <p className="text-xs text-ink/65">
            rho means an event on an AAS arc: l↑ (outgoing arc/start), l↓ (incoming arc/end).
          </p>
        </article>

        <article className="glass-card rounded-3xl p-5 shadow-glow sm:p-6">
          <div className="mb-4 flex flex-wrap gap-2 text-xs font-semibold uppercase tracking-wide">
            <span className="rounded-full bg-sea/15 px-3 py-1 text-sea">
              lunghezza seq: {parseResult.data?.sequence.length ?? 0}
            </span>
            <span className="rounded-full bg-coral/15 px-3 py-1 text-coral">
              coppie: {parseResult.data?.pairs.length ?? 0}
            </span>
            <span className="rounded-full bg-ink/10 px-3 py-1 text-ink/70">
              status: {parseResult.data ? "valid" : "needs correction"}
            </span>
          </div>

          <h2 className="mb-3 text-sm font-semibold uppercase tracking-[0.2em] text-ink/70">Output parser</h2>

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
    </section>
  );
}
