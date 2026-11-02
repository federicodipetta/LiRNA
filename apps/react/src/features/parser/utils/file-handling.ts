/**
 * Drag-and-drop file collection and import utilities
 */

export function dedupeFiles(files: File[]): File[] {
  const unique = new Map<string, File>();
  for (const file of files) {
    unique.set(`${file.name}:${file.size}:${file.lastModified}`, file);
  }
  return Array.from(unique.values());
}

export async function collectDroppedFiles(dataTransfer: DataTransfer): Promise<File[]> {
  const directFiles = Array.from(dataTransfer.files ?? []);
  const items = Array.from(dataTransfer.items ?? []);

  const webkitEntries = items
    .map((item) => {
      const withEntry = item as DataTransferItem & {
        webkitGetAsEntry?: () => {
          isFile?: boolean;
          isDirectory?: boolean;
          file?: (cb: (file: File) => void, errCb?: () => void) => void;
          createReader?: () => {
            readEntries: (
              cb: (entries: unknown[]) => void,
              errCb?: () => void,
            ) => void;
          };
        } | null;
      };
      return withEntry.webkitGetAsEntry?.() ?? null;
    })
    .filter(Boolean);

  if (webkitEntries.length === 0) {
    return directFiles;
  }

  const fromEntries: File[] = [];

  async function walk(entry: {
    isFile?: boolean;
    isDirectory?: boolean;
    file?: (cb: (file: File) => void, errCb?: () => void) => void;
    createReader?: () => {
      readEntries: (
        cb: (entries: unknown[]) => void,
        errCb?: () => void,
      ) => void;
    };
  }): Promise<void> {
    if (entry.isFile && entry.file) {
      await new Promise<void>((resolve) => {
        entry.file?.(
          (file) => {
            fromEntries.push(file);
            resolve();
          },
          () => resolve(),
        );
      });
      return;
    }

    if (!entry.isDirectory || !entry.createReader) {
      return;
    }

    const reader = entry.createReader();

    while (true) {
      const entries = await new Promise<unknown[]>((resolve) => {
        reader.readEntries(
          (readEntries) => resolve(readEntries),
          () => resolve([]),
        );
      });

      if (entries.length === 0) {
        break;
      }

      for (const child of entries) {
        await walk(
          child as {
            isFile?: boolean;
            isDirectory?: boolean;
            file?: (cb: (file: File) => void, errCb?: () => void) => void;
            createReader?: () => {
              readEntries: (
                cb: (entries: unknown[]) => void,
                errCb?: () => void,
              ) => void;
            };
          },
        );
      }
    }
  }

  for (const entry of webkitEntries) {
    await walk(
      entry as {
        isFile?: boolean;
        isDirectory?: boolean;
        file?: (cb: (file: File) => void, errCb?: () => void) => void;
        createReader?: () => {
          readEntries: (cb: (entries: unknown[]) => void, errCb?: () => void) => void;
        };
      },
    );
  }

  return dedupeFiles([...directFiles, ...fromEntries]);
}

export function downloadJson(obj: unknown, fileName: string): void {
  const json = JSON.stringify(obj, null, 2);
  const blob = new Blob([json], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
