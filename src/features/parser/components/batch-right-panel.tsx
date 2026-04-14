/**
 * Batch right panel: Formula, output destination, results
 */

import { TextAreaField } from "./form-fields";
import { downloadJson } from "../utils/file-handling";
import type { BatchExportResult, BatchResultEntry } from "../types/parser";

interface BatchRightPanelProps {
  formulaInput: string;
  onFormulaChange: (value: string) => void;
  formulaError: string | null;
  outputDirectoryHandle: unknown;
  autoWriteOnRun: boolean;
  onAutoWriteChange: (checked: boolean) => void;
  onChooseOutputDirectory: () => void;
  loading: boolean;
  onRunBatch: () => void;
  batchResults: BatchExportResult | null;
  selectedRowResult: BatchResultEntry | null;
  selectedJsonPreview: string | null;
}

export function BatchRightPanel(props: BatchRightPanelProps) {
  const {
    formulaInput,
    onFormulaChange,
    formulaError,
    outputDirectoryHandle,
    autoWriteOnRun,
    onAutoWriteChange,
    onChooseOutputDirectory,
    loading,
    onRunBatch,
    batchResults,
    selectedRowResult,
    selectedJsonPreview,
  } = props;

  const hasOutputDir = outputDirectoryHandle !== null;

  return (
    <article className="glass-card space-y-4 rounded-3xl p-5 shadow-glow sm:p-6">
      <TextAreaField
        id="batch-formula"
        label="Batch LTL formula"
        value={formulaInput}
        onChange={onFormulaChange}
        rows={4}
        placeholder="Example: <>(l↑ U O(l↓ | true))"
        error={formulaError ?? undefined}
      />

      <div className="rounded-2xl border border-ink/15 bg-white/70 p-3">
        <p className="text-xs font-semibold uppercase tracking-wide text-ink/70">Output destination</p>
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={onChooseOutputDirectory}
            title={hasOutputDir ? "Directory selected" : "Select output directory"}
            className={`rounded-xl border px-3 py-2 text-xs font-semibold uppercase tracking-wide ${
              hasOutputDir
                ? "border-sea/30 bg-sea/10 text-sea"
                : "border-ink/15 bg-white text-ink"
            }`}
          >
            {hasOutputDir ? "✓ Folder selected" : "Choose output folder"}
          </button>
          <label className="flex items-center gap-2 text-xs text-ink/70">
            <input
              type="checkbox"
              checked={autoWriteOnRun}
              onChange={(event) => onAutoWriteChange(event.currentTarget.checked)}
              disabled={!hasOutputDir}
            />
            Auto-write JSON on run
          </label>
        </div>
        <p className="mt-2 text-xs text-ink/60">
          Auto-write works only if browser allows directory write permissions.
        </p>
      </div>

      <button
        type="button"
        onClick={onRunBatch}
        disabled={loading}
        className="w-full rounded-xl bg-sea px-4 py-3 text-sm font-semibold uppercase tracking-wide text-white transition hover:bg-sea/85 disabled:opacity-50"
      >
        {loading ? "Running..." : "Run batch"}
      </button>

      {batchResults ? (
        <>
          <button
            type="button"
            onClick={() => downloadJson(batchResults, `lirna-batch-results-${Date.now()}.json`)}
            className="w-full rounded-xl border border-sea/30 bg-sea/10 px-4 py-3 text-sm font-semibold uppercase tracking-wide text-sea transition hover:bg-sea/20"
          >
            Download batch JSON
          </button>
          <div className="rounded-2xl border border-ink/15 bg-white/70 p-3">
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-ink/70">
              {selectedRowResult ? `Selected result: ${selectedRowResult.name}` : "Batch JSON preview"}
            </p>
            <pre className="max-h-[28rem] overflow-auto rounded-2xl border border-ink/15 bg-ink p-4 text-xs leading-relaxed text-mist sm:text-sm">
              {selectedJsonPreview ?? JSON.stringify(batchResults, null, 2)}
            </pre>
          </div>
        </>
      ) : (
        <p className="text-sm text-ink/70">
          Run the batch to preview JSON output. Click JSON on a row to inspect only that molecule.
        </p>
      )}
    </article>
  );
}
