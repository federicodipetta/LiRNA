import { useEffect, useMemo, useState, useRef } from "react";
import { useParserForm } from "../hooks/useParserForm";
import { parseAasContent, processBatchStructures } from "../services/parser";
import { parseLtlFormula } from "../services/ltl-sat";
import type { BatchExportResult, BatchResultEntry } from "../types/parser";
import type { WorkbenchMode, BatchDraftStructure, BatchValidation } from "../types/batch";
import {
  createEmptyBatchStructure,
  getAasBaseName,
  computeBatchValidation,
} from "../utils/batch-utils";
import { BaseModePanel } from "./base-mode-panel";
import { BatchLeftPanel } from "./batch-left-panel";
import { BatchRightPanel } from "./batch-right-panel";

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

  const [mode, setMode] = useState<WorkbenchMode>("base");
  const [importIssue, setImportIssue] = useState<string | null>(null);

  // Batch mode state
  const [batchFormulaInput, setBatchFormulaInput] = useState("<>(l↑)");
  const [batchStructures, setBatchStructures] = useState<BatchDraftStructure[]>([
    createEmptyBatchStructure(0),
  ]);
  const [selectedBatchRowId, setSelectedBatchRowId] = useState<string | null>(null);
  const [expandedBatchRowId, setExpandedBatchRowId] = useState<string | null>(null);
  const [isBatchDragOver, setIsBatchDragOver] = useState(false);
  const [outputDirectoryHandle, setOutputDirectoryHandle] = useState<FileSystemDirectoryHandle | null>(null);
  const [autoWriteOnRun, setAutoWriteOnRun] = useState(false);
  const [isBatchRunning, setIsBatchRunning] = useState(false);
  const [batchResults, setBatchResults] = useState<BatchExportResult | null>(null);
  const [batchResultByRowId, setBatchResultByRowId] = useState<Record<string, BatchResultEntry>>({});

  const folderInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    folderInputRef.current?.setAttribute("webkitdirectory", "");
    folderInputRef.current?.setAttribute("directory", "");
  }, []);

  const batchFormulaError = useMemo(() => {
    if (!batchFormulaInput.trim()) {
      return "Insert a batch LTL formula.";
    }

    const parsed = parseLtlFormula(batchFormulaInput);
    return parsed.formula ? null : parsed.error ?? "Invalid batch formula.";
  }, [batchFormulaInput]);

  // Compute batch validation for all rows
  const batchValidationByRowId = useMemo(() => {
    const validation: Record<string, BatchValidation> = computeBatchValidation(
      batchStructures,
      batchFormulaInput,
      batchFormulaError,
    );
    return validation;
  }, [batchStructures, batchFormulaInput, batchFormulaError]);

  const selectedRowResult = selectedBatchRowId ? batchResultByRowId[selectedBatchRowId] : null;

  const selectedJsonPreview = useMemo(() => {
    if (!selectedRowResult) {
      return null;
    }

    return JSON.stringify(selectedRowResult, null, 2);
  }, [selectedRowResult]);

  // Batch mode handlers
  const handleImportAasFolder = async (files: FileList | File[]) => {
    const aasFiles = Array.from(files).filter((file) => 
      file.name.toLowerCase().endsWith(".aas")
    );

    if (aasFiles.length === 0) {
      setImportIssue("Select files or folders containing at least one .aas file.");
      return;
    }

    const imported: BatchDraftStructure[] = [];

    for (const [index, file] of aasFiles.entries()) {
      try {
        const content = await file.text();
        const parsed = parseAasContent(content);
        if (parsed.issue) {
          continue;
        }

        imported.push({
          id: `file_${Date.now()}_${index}`,
          name: getAasBaseName(file.name),
          sequence: parsed.sequence,
          pairs: parsed.pairsInput,
          isLocked: true,
        });
      } catch (error) {
        console.error(`Failed to parse ${file.name}:`, error);
        continue;
      }
    }

    if (imported.length === 0) {
      setImportIssue("No valid .aas structure found in dropped/selected content.");
      return;
    }

    setBatchStructures((current) => [...current, ...imported]);
    setImportIssue(`Imported ${imported.length} .aas structures.`);
  };

  const handleAddBatchStructure = () => {
    setBatchStructures((current) => [...current, createEmptyBatchStructure(current.length)]);
    setBatchResults(null);
    setBatchResultByRowId({});
  };

  const handleUpdateBatchStructure = (
    id: string,
    key: "name" | "sequence" | "pairs",
    value: string,
  ) => {
    setBatchStructures((current) =>
      current.map((row) => (row.id === id ? { ...row, [key]: value } : row)),
    );
    setBatchResults(null);
    setBatchResultByRowId((current) => {
      const next = { ...current };
      delete next[id];
      return next;
    });
  };

  const handleRemoveBatchStructure = (id: string) => {
    setBatchStructures((current) => current.filter((row) => row.id !== id));
    setBatchResults(null);
    setBatchResultByRowId((current) => {
      const next = { ...current };
      delete next[id];
      return next;
    });
    if (selectedBatchRowId === id) {
      setSelectedBatchRowId(null);
    }
    if (expandedBatchRowId === id) {
      setExpandedBatchRowId(null);
    }
  };

  const handleChooseOutputDirectory = async () => {
    const withDirectoryPicker = window as Window & {
      showDirectoryPicker?: () => Promise<FileSystemDirectoryHandle>;
    };

    if (!withDirectoryPicker.showDirectoryPicker) {
      setImportIssue("Directory write API not supported in this browser context.");
      return;
    }

    try {
      const handle = await withDirectoryPicker.showDirectoryPicker();
      setOutputDirectoryHandle(handle);
      setImportIssue("Output directory selected. You can enable auto-write on run.");
    } catch {
      setImportIssue("Output directory selection cancelled.");
    }
  };

  const handleWriteBatchJsonToDirectory = async (exportJson: BatchExportResult) => {
    if (!outputDirectoryHandle) {
      throw new Error("Output directory handle not set.");
    }

    const fileName = `lirna-batch-results-${Date.now()}.json`;
    const fileHandle = await outputDirectoryHandle.getFileHandle(fileName, { create: true });
    const writable = await fileHandle.createWritable();
    await writable.write(JSON.stringify(exportJson, null, 2));
    await writable.close();

    const folderName = outputDirectoryHandle.name ? ` (${outputDirectoryHandle.name})` : "";
    setImportIssue(`Batch JSON saved automatically as ${fileName}${folderName}.`);
  };

  const handleRunBatch = async () => {
    if (batchFormulaError) {
      setImportIssue(batchFormulaError);
      return;
    }

    const candidates = batchStructures.filter((row) => {
      const validation = batchValidationByRowId[row.id];
      return validation?.isValidCandidate ?? false;
    });

    if (candidates.length === 0) {
      setImportIssue("Add at least one valid structure in batch mode.");
      return;
    }

    try {
      setIsBatchRunning(true);
      const exportJson = processBatchStructures(
        candidates.map((row) => ({
          name: row.name,
          sequence: row.sequence,
          pairs: row.pairs,
          formula: batchFormulaInput,
        })),
      );

      const byRowId: Record<string, BatchResultEntry> = {};
      exportJson.results.forEach((result, index) => {
        const rowId = candidates[index]?.id;
        if (rowId) {
          byRowId[rowId] = result;
        }
      });

      setBatchResults(exportJson);
      setBatchResultByRowId(byRowId);
      setSelectedBatchRowId((current) => current ?? candidates[0]?.id ?? null);

      if (autoWriteOnRun && outputDirectoryHandle) {
        try {
          await handleWriteBatchJsonToDirectory(exportJson);
          return;
        } catch (error) {
          console.error("Auto-write failed:", error);
          setImportIssue("Batch completed, but automatic write failed. Use manual download.");
          return;
        }
      }

      setImportIssue(null);
    } catch (error) {
      console.error("Batch processing error:", error);
      setImportIssue(`Batch processing failed: ${error instanceof Error ? error.message : "unknown"}`);
    } finally {
      setIsBatchRunning(false);
    }
  };

  return (
    <section className="mx-auto max-w-6xl animate-drift space-y-6">
      <header className="space-y-3 text-center">
        <h1 className="text-balance text-3xl font-bold tracking-tight text-ink sm:text-5xl">
          LiRNA Workbench
        </h1>
        <p className="mx-auto max-w-2xl text-sm text-ink/80 sm:text-base">
          Parse single structures in Base mode, or evaluate many structures in Batch mode.
        </p>
      </header>

      <div className="mx-auto flex w-full max-w-md rounded-2xl border border-ink/15 bg-white/70 p-1">
        <button
          type="button"
          onClick={() => setMode("base")}
          className={`flex-1 rounded-xl px-3 py-2 text-sm font-semibold ${
            mode === "base" ? "bg-ink text-mist" : "text-ink/70"
          }`}
        >
          📄 Base
        </button>
        <button
          type="button"
          onClick={() => setMode("batch")}
          className={`flex-1 rounded-xl px-3 py-2 text-sm font-semibold ${
            mode === "batch" ? "bg-ink text-mist" : "text-ink/70"
          }`}
        >
          📦 Batch
        </button>
      </div>

      {mode === "base" ? (
        <BaseModePanel
          sequenceInput={sequenceInput}
          setSequenceInput={setSequenceInput}
          pairsInput={pairsInput}
          setPairsInput={setPairsInput}
          thirdInput={thirdInput}
          setThirdInput={setThirdInput}
          parseResult={parseResult}
        />
      ) : (
        <div className="grid gap-6 lg:grid-cols-[1.25fr_1fr]">
          {/* Left Panel: Batch Structures */}
          <BatchLeftPanel
            structures={batchStructures}
            validationByRowId={batchValidationByRowId}
            resultByRowId={batchResultByRowId}
            expandedRowId={expandedBatchRowId}
            isDragOver={isBatchDragOver}
            importIssue={importIssue}
            onImportFiles={handleImportAasFolder}
            onAddStructure={handleAddBatchStructure}
            onUpdateStructure={handleUpdateBatchStructure}
            onRemoveStructure={handleRemoveBatchStructure}
            onToggleExpand={(id) =>
              setExpandedBatchRowId((current) => (current === id ? null : id))
            }
            onSelectJson={setSelectedBatchRowId}
            onDragOver={(over) => setIsBatchDragOver(over)}
          />

          {/* Right Panel: Batch Settings & Results */}
          <BatchRightPanel
            formulaInput={batchFormulaInput}
            onFormulaChange={(value) => {
              setBatchFormulaInput(value);
              setBatchResults(null);
              setBatchResultByRowId({});
            }}
            formulaError={batchFormulaError}
            outputDirectoryHandle={outputDirectoryHandle}
            autoWriteOnRun={autoWriteOnRun}
            onAutoWriteChange={setAutoWriteOnRun}
            onChooseOutputDirectory={() => {
              void handleChooseOutputDirectory();
            }}
            loading={isBatchRunning}
            batchResults={batchResults}
            selectedRowResult={selectedRowResult}
            selectedJsonPreview={selectedJsonPreview}
            onRunBatch={handleRunBatch}
          />
        </div>
      )}
    </section>
  );
}
