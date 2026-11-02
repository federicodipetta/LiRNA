/**
 * Compact batch structure row component
 */

import type { BatchDraftStructure, BatchValidation } from "../types/batch";
import type { BatchResultEntry } from "../types/parser";

interface BatchRowCardProps {
  row: BatchDraftStructure;
  validation: BatchValidation | undefined;
  rowResult: BatchResultEntry | undefined;
  isExpanded: boolean;
  onToggleExpand: () => void;
  onSelectJson: () => void;
  onRemove: () => void;
  onUpdateField: (key: "name" | "sequence" | "pairs", value: string) => void;
}

export function BatchRowCard(props: BatchRowCardProps) {
  const { row, validation, rowResult, isExpanded, onToggleExpand, onSelectJson, onRemove, onUpdateField } = props;

  const satCount = rowResult?.satResult?.length ?? 0;
  const { statusLabel, statusClass } = getRowStatus(validation, rowResult);

  return (
    <div key={row.id} className="rounded-2xl border border-ink/15 bg-white/80 p-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="space-y-1">
          <p className="text-sm font-semibold text-ink">{row.name || "unnamed"}</p>
          <p className="text-xs text-ink/60">
            {row.isLocked ? "File row" : "Manual row"} · seq {row.sequence.trim().length} ·
            pairs {row.pairs.trim().length > 0 ? "yes" : "no"}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${statusClass}`}>
            {statusLabel}
          </span>
          {rowResult?.isValid ? (
            <span className="rounded-full bg-sea/10 px-2.5 py-1 text-xs font-semibold text-sea">
              sat: {satCount}
            </span>
          ) : null}
          {rowResult ? (
            <button
              type="button"
              onClick={onSelectJson}
              className="rounded-lg border border-ink/15 px-2.5 py-1 text-xs font-semibold text-ink/75"
            >
              JSON
            </button>
          ) : null}
          <button
            type="button"
            onClick={onToggleExpand}
            className="rounded-lg border border-ink/15 px-2.5 py-1 text-xs font-semibold text-ink/75"
          >
            {isExpanded ? "Close" : row.isLocked ? "Details" : "Edit"}
          </button>
          <button
            type="button"
            onClick={onRemove}
            className="rounded-lg border border-coral/30 px-2.5 py-1 text-xs font-semibold text-coral"
          >
            Remove
          </button>
        </div>
      </div>

      {validation?.issues.length ? (
        <p className="mt-2 text-xs font-medium text-coral">{validation.issues[0]}</p>
      ) : null}

      {isExpanded ? (
        <div className="mt-3 space-y-2 border-t border-ink/10 pt-3">
          <label className="block space-y-1">
            <span className="text-xs font-semibold text-ink/70">Name</span>
            <input
              type="text"
              value={row.name}
              disabled={row.isLocked}
              onChange={(event) => onUpdateField("name", event.currentTarget.value)}
              className="w-full rounded-xl border border-ink/15 bg-white px-3 py-2 text-sm text-ink outline-none focus:border-sea"
            />
          </label>

          <label className="block space-y-1">
            <span className="text-xs font-semibold text-ink/70">Sequence</span>
            <textarea
              rows={2}
              value={row.sequence}
              disabled={row.isLocked}
              onChange={(event) => onUpdateField("sequence", event.currentTarget.value)}
              className="w-full resize-y rounded-xl border border-ink/15 bg-white px-3 py-2 text-sm text-ink outline-none focus:border-sea"
            />
          </label>

          <label className="block space-y-1">
            <span className="text-xs font-semibold text-ink/70">Pairs</span>
            <textarea
              rows={2}
              value={row.pairs}
              disabled={row.isLocked}
              onChange={(event) => onUpdateField("pairs", event.currentTarget.value)}
              className="w-full resize-y rounded-xl border border-ink/15 bg-white px-3 py-2 text-sm text-ink outline-none focus:border-sea"
            />
          </label>
        </div>
      ) : null}
    </div>
  );
}

function getRowStatus(
  validation: BatchValidation | undefined,
  rowResult: BatchResultEntry | undefined,
): { statusLabel: string; statusClass: string } {
  if (!validation?.hasContent) {
    return { statusLabel: "to process", statusClass: "bg-ink/10 text-ink/70" };
  }

  if (rowResult) {
    if (rowResult.isValid) {
      return { statusLabel: "processed", statusClass: "bg-sea/15 text-sea" };
    } else {
      return { statusLabel: "invalid", statusClass: "bg-coral/15 text-coral" };
    }
  }

  if (validation.isValidCandidate) {
    return { statusLabel: "ready", statusClass: "bg-amber-200/60 text-amber-700" };
  }

  return { statusLabel: "invalid", statusClass: "bg-coral/15 text-coral" };
}
