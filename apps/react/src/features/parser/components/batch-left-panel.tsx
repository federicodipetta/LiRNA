/**
 * Batch left panel: Import and structure list
 */

import { useRef } from "react";
import { collectDroppedFiles } from "../utils/file-handling";
import { BatchRowCard } from "./batch-row-card";
import type { BatchDraftStructure, BatchValidation } from "../types/batch";
import type { BatchResultEntry } from "../types/parser";

interface BatchLeftPanelProps {
  structures: BatchDraftStructure[];
  validationByRowId: Record<string, BatchValidation>;
  resultByRowId: Record<string, BatchResultEntry>;
  expandedRowId: string | null;
  importIssue: string | null;
  isDragOver: boolean;
  onImportFiles: (files: File[]) => Promise<void>;
  onAddStructure: () => void;
  onUpdateStructure: (id: string, key: "name" | "sequence" | "pairs", value: string) => void;
  onRemoveStructure: (id: string) => void;
  onToggleExpand: (id: string) => void;
  onSelectJson: (id: string) => void;
  onDragOver: (over: boolean) => void;
}

export function BatchLeftPanel(props: BatchLeftPanelProps) {
  const {
    structures,
    validationByRowId,
    resultByRowId,
    expandedRowId,
    importIssue,
    isDragOver,
    onImportFiles,
    onAddStructure,
    onUpdateStructure,
    onRemoveStructure,
    onToggleExpand,
    onSelectJson,
    onDragOver,
  } = props;

  const folderInputRef = useRef<HTMLInputElement>(null);

  return (
    <article className="glass-card space-y-4 rounded-3xl p-5 shadow-glow sm:p-6">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold uppercase tracking-[0.2em] text-ink/70">Batch structures</h2>
        <button
          type="button"
          onClick={onAddStructure}
          className="rounded-xl bg-ink px-3 py-2 text-sm font-bold text-mist transition hover:bg-ink/85"
        >
          +
        </button>
      </div>

      <div
        onDragOver={(event) => {
          event.preventDefault();
          onDragOver(true);
        }}
        onDragLeave={() => onDragOver(false)}
        onDrop={async (event) => {
          event.preventDefault();
          onDragOver(false);
          const droppedFiles = await collectDroppedFiles(event.dataTransfer);
          await onImportFiles(droppedFiles);
        }}
        className={`rounded-2xl border border-dashed p-4 transition ${
          isDragOver ? "border-sea bg-sea/10" : "border-ink/20 bg-white/60"
        }`}
      >
        <p className="text-sm font-medium text-ink/80">Import .aas (files/folder)</p>
        <p className="text-xs text-ink/65">Drag and drop multiple .aas files or a folder, or use the folder picker.</p>
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => folderInputRef.current?.click()}
            className="rounded-xl border border-ink/15 bg-white/80 px-3 py-2 text-xs font-semibold uppercase tracking-wide text-ink transition hover:bg-white"
          >
            Import folder (.aas)
          </button>
          <span className="text-xs text-ink/60">Imported files are compact and locked; manual rows remain editable.</span>
        </div>
      </div>

      <input
        ref={folderInputRef}
        type="file"
        multiple
        className="hidden"
        onChange={async (event) => {
          const files = event.currentTarget.files;
          if (files) {
            await onImportFiles(Array.from(files));
          }
          event.currentTarget.value = "";
        }}
      />

      {importIssue ? <p className="text-sm font-medium text-coral">{importIssue}</p> : null}

      <div className="space-y-3">
        {structures.map((row) => (
          <BatchRowCard
            key={row.id}
            row={row}
            validation={validationByRowId[row.id]}
            rowResult={resultByRowId[row.id]}
            isExpanded={expandedRowId === row.id}
            onToggleExpand={() => onToggleExpand(row.id)}
            onSelectJson={() => onSelectJson(row.id)}
            onRemove={() => onRemoveStructure(row.id)}
            onUpdateField={(key, value) => onUpdateStructure(row.id, key, value)}
          />
        ))}
      </div>
    </article>
  );
}
