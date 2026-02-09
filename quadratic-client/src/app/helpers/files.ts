import type { ClientCoreImportFile, CoreClientImportFile } from '@/app/web-workers/quadraticCore/coreClientMessages';

export function stripExtension(name: string): string {
  return name.replace(/\.[^/.]+$/, '');
}

export function getExtension(name: string): string {
  return name.split('.').pop() || '';
}

export function getFileTypeFromName(name: string): 'CSV' | 'Excel' | 'Parquet' | 'Grid' | undefined {
  const extension = getExtension(name);
  if (extension === 'csv') return 'CSV';
  if (extension === 'xlsx') return 'Excel';
  if (extension === 'xls') return 'Excel';
  if (extension === 'parquet' || extension === 'parq' || extension === 'pqt') return 'Parquet';
  if (extension === 'grid') return 'Grid';
  return undefined;
}

export function hasExtension(name: string, extension: string): boolean {
  return new RegExp(`\\.${extension}$`, 'i').test(name);
}

export function hasExtensions(name: string, extensions: string[]): boolean {
  return extensions.some((extension) => hasExtension(name, extension));
}

export function isCsv(file: File): boolean {
  return file.type === 'text/csv' || file.type === 'text/tab-separated-values' || hasExtension(file.name, 'csv');
}

export function isExcelMimeType(mimeType: string): boolean {
  return ['application/vnd.ms-excel', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'].includes(
    mimeType
  );
}

export function isExcel(file: File): boolean {
  return isExcelMimeType(file.type) || hasExtension(file.name, 'xlsx');
}

export function isGrid(file: File): boolean {
  return file.type === 'application/json' || hasExtension(file.name, 'grid');
}

// NOTE(ddimaria): this mime type was registered in March 2024, so isn't supported yet
export function isParquet(file: File): boolean {
  return file.type === 'application/vnd.apache.parquet' || hasExtensions(file.name, ['parquet', 'parq', 'pqt']);
}

export const getFileType = (file: File) => {
  if (isCsv(file)) return 'CSV';
  if (isExcel(file)) return 'Excel';
  if (isParquet(file)) return 'Parquet';
  if (isGrid(file)) return 'Grid';

  throw new Error(`Unsupported file type`);
};

export const uploadFile = async (fileTypes: string[]): Promise<File[]> => {
  const files = await new Promise<File[]>((resolve) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = fileTypes.join(',');
    input.multiple = true;
    input.onchange = () => {
      if (!input.files) return;
      resolve(Array.from(input.files));
    };
    input.click();
  });
  return files;
};

export const arrayBufferToBase64 = (arrayBuffer: ArrayBuffer) => {
  const uint8Array = new Uint8Array(arrayBuffer);
  const binaryString = uint8Array.reduce((str, byte) => str + String.fromCharCode(byte), '');
  return btoa(binaryString);
};

export const supportedFileTypes = ['.grid', '.xlsx', '.xls', '.csv', '.parquet', '.parq', '.pqt'];
export const supportedFileTypesFromGrid = supportedFileTypes.filter((type) => type !== '.grid');

// All file types supported by the AI Analyst for import (spreadsheets + PDFs/images for AI processing)
export const aiAnalystImportFileTypes = ['image/*', '.pdf', '.xlsx', '.xls', '.csv', '.parquet', '.parq', '.pqt'];

export interface FileImportProgress {
  name: string;
  size: number;
  step: 'read' | 'create' | 'save' | 'done' | 'error' | 'cancel';
  progress: number;
}

export interface FilesImportProgressState {
  importing: boolean;
  createNewFile: boolean;
  currentFileIndex?: number;
  files: FileImportProgress[];
}

interface ImportFilesOptions {
  files: File[];
  sheetId: string;
  getBounds: () => { type: 'empty' } | { type: 'nonEmpty'; max: { x: bigint } };
  getCursorPosition: () => string;
  setProgressState?: (
    updater: FilesImportProgressState | ((prev: FilesImportProgressState) => FilesImportProgressState)
  ) => void;
  importFile: (params: Omit<ClientCoreImportFile, 'type' | 'id'>) => Promise<Omit<CoreClientImportFile, 'type' | 'id'>>;
}

/**
 * Imports files into the sheet, splitting them between direct import (spreadsheets)
 * and AI processing (PDFs/images).
 *
 * @returns Array of files that need AI processing (PDFs/images)
 */
export async function importFilesToSheet({
  files,
  sheetId,
  getBounds,
  getCursorPosition,
  setProgressState,
  importFile,
}: ImportFilesOptions): Promise<File[]> {
  if (files.length === 0) return [];

  // Split files: direct import for spreadsheet files, AI for PDFs/images
  const directImportFiles: File[] = [];
  const aiFiles: File[] = [];

  for (const file of files) {
    const extension = `.${getExtension(file.name)}`;
    if (supportedFileTypesFromGrid.includes(extension)) {
      directImportFiles.push(file);
    } else {
      // PDFs and images need AI to extract data
      aiFiles.push(file);
    }
  }

  // Import spreadsheet files directly - each placed to the right of existing content
  if (directImportFiles.length > 0) {
    // Sort: push Excel files to the end (they create new sheets, so order matters less)
    directImportFiles.sort((a, b) => {
      const extA = getExtension(a.name);
      const extB = getExtension(b.name);
      if (['xls', 'xlsx'].includes(extA)) return 1;
      if (['xls', 'xlsx'].includes(extB)) return -1;
      return 0;
    });

    // Initialize the import progress state if setter provided
    if (setProgressState) {
      setProgressState({
        importing: true,
        createNewFile: false,
        files: directImportFiles.map(
          (file): FileImportProgress => ({
            name: file.name,
            size: file.size,
            step: 'read',
            progress: 0,
          })
        ),
      });
    }

    // Import files one at a time, calculating position based on current bounds
    for (let i = 0; i < directImportFiles.length; i++) {
      const file = directImportFiles[i];
      const fileType = getFileTypeFromName(file.name);
      if (!fileType || fileType === 'Grid') continue;

      // Update the current file index
      if (setProgressState) {
        setProgressState((prev) => ({
          ...prev,
          currentFileIndex: i,
        }));
      }

      const arrayBuffer = await file.arrayBuffer();

      // Calculate insert position: to the right of existing content
      const sheetBounds = getBounds();
      const insertAt = {
        x: sheetBounds.type === 'empty' ? 1 : Number(sheetBounds.max.x) + 2,
        y: 1,
      };

      try {
        await importFile({
          file: arrayBuffer,
          fileName: file.name,
          fileType,
          sheetId,
          location: insertAt,
          cursor: getCursorPosition(),
          isAi: false,
        });
      } catch (error) {
        console.error('[AIAnalyst] Error importing file:', file.name, error);
        // Update progress state to reflect the error
        if (setProgressState) {
          setProgressState((prev) => ({
            ...prev,
            files: prev.files.map((f, idx) => (idx === i ? { ...f, step: 'error' } : f)),
          }));
        }
      }
    }

    // Reset the import progress state
    if (setProgressState) {
      setProgressState({
        importing: false,
        createNewFile: false,
        files: [],
      });
    }
  }

  return aiFiles;
}
