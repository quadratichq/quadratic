import { aiAnalystCurrentChatMessagesAtom, aiAnalystImportFilesToGridAtom } from '@/app/atoms/aiAnalystAtom';
import {
  editorInteractionStatePermissionsAtom,
  editorInteractionStateTeamUuidAtom,
} from '@/app/atoms/editorInteractionStateAtom';
import { sheets } from '@/app/grid/controller/Sheets';
import { getFileTypeFromName, stripExtension } from '@/app/helpers/files';
import type { JsCoordinate } from '@/app/quadratic-core-types';
import { quadraticCore } from '@/app/web-workers/quadraticCore/quadraticCore';
import { filesImportProgressAtom, type FileImportProgress } from '@/dashboard/atoms/filesImportProgressAtom';
import { apiClient } from '@/shared/api/apiClient';
import { ROUTES } from '@/shared/constants/routes';
import { Buffer } from 'buffer';
import { createInternalImportFilesContent } from 'quadratic-shared/ai/helpers/message.helper';
import type { ImportFilesToGridContent, InternalImportFile } from 'quadratic-shared/typesAndSchemasAI';
import { useRecoilCallback } from 'recoil';

export interface ImportFile {
  name: string;
  size: number;
  data: ArrayBuffer;
}

export interface ImmediateImportResult {
  success: boolean;
  fileName: string;
  responsePrompt?: string;
  error?: string;
  /** For CSV/Parquet imports, the name of the table that was created */
  tableName?: string;
  /** For Grid file imports, whether we navigated to a new file */
  navigatedToNewFile?: boolean;
  newFileUuid?: string;
}

/**
 * Hook for immediate file imports when files are dropped into AI chat.
 * Handles CSV, Excel, Parquet files normally, and Grid files with special logic:
 * - If current file is empty: replace current file contents with grid file
 * - If current file is not empty: create a new file and navigate to it
 */
export const useImmediateFileImport = () => {
  const immediateImportFile = useRecoilCallback(
    ({ snapshot, set }) =>
      async (importFile: ImportFile): Promise<ImmediateImportResult> => {
        const permissions = await snapshot.getPromise(editorInteractionStatePermissionsAtom);
        if (!permissions.includes('FILE_EDIT')) {
          return {
            success: false,
            fileName: importFile.name,
            error: 'No permission to edit file',
          };
        }

        const fileType = getFileTypeFromName(importFile.name);
        if (!fileType) {
          return {
            success: false,
            fileName: importFile.name,
            error: 'Unsupported file type',
          };
        }

        set(aiAnalystImportFilesToGridAtom, { loading: true });

        // Initialize import progress
        set(filesImportProgressAtom, {
          importing: true,
          createNewFile: false,
          files: [
            {
              name: importFile.name,
              size: importFile.size,
              step: 'read',
              progress: 0,
            } as FileImportProgress,
          ],
        });

        // Create internal message for import progress display
        const importFilesToGridContent: ImportFilesToGridContent = {
          source: 'import_files_to_grid' as const,
          files: [],
        };
        set(aiAnalystCurrentChatMessagesAtom, (prev) => {
          return [...prev, createInternalImportFilesContent(importFilesToGridContent)];
        });

        const currentImportFile: InternalImportFile = {
          fileName: importFile.name,
          loading: true,
          error: undefined,
        };
        set(aiAnalystCurrentChatMessagesAtom, (prev) => {
          importFilesToGridContent.files = [{ ...currentImportFile }];
          return [...prev.slice(0, -1), createInternalImportFilesContent(importFilesToGridContent)];
        });

        let result: ImmediateImportResult;

        try {
          if (fileType === 'Grid') {
            result = await handleGridFileImport(importFile, snapshot);
          } else {
            result = await handleDataFileImport(importFile, fileType);
          }

          currentImportFile.loading = false;
          if (!result.success) {
            currentImportFile.error = result.error;
          }
        } catch (error) {
          console.error('[useImmediateFileImport] Error importing file', error);
          const errorString = error instanceof Error ? error.message : String(error);
          currentImportFile.loading = false;
          currentImportFile.error = errorString;
          result = {
            success: false,
            fileName: importFile.name,
            error: errorString,
          };
        } finally {
          // Update the chat message with final status
          set(aiAnalystCurrentChatMessagesAtom, (prev) => {
            importFilesToGridContent.files = [{ ...currentImportFile }];
            return [...prev.slice(0, -1), createInternalImportFilesContent(importFilesToGridContent)];
          });

          // Reset import progress
          set(filesImportProgressAtom, {
            importing: false,
            createNewFile: false,
            files: [],
          });

          set(aiAnalystImportFilesToGridAtom, { loading: false });
        }

        return result;
      },
    []
  );

  return { immediateImportFile };
};

/**
 * Handle importing CSV, Excel, or Parquet files into the current grid
 */
async function handleDataFileImport(
  importFile: ImportFile,
  fileType: 'CSV' | 'Excel' | 'Parquet'
): Promise<ImmediateImportResult> {
  const currentSheet = sheets.sheet;
  const sheetBounds = currentSheet.bounds;

  const insertAt: JsCoordinate = {
    x: sheetBounds.type === 'empty' ? 1 : Number(sheetBounds.max.x) + 2,
    y: 1,
  };

  try {
    const response = await quadraticCore.importFile({
      file: importFile.data,
      fileName: importFile.name,
      fileType,
      sheetId: currentSheet.id,
      location: insertAt,
      cursor: sheets.sheet.cursor.position.toString(),
      isAi: true,
    });

    if (response.error) {
      return {
        success: false,
        fileName: importFile.name,
        error: response.error,
      };
    }

    // For CSV and Parquet, a data table is created with a name based on the file name
    // Excel files create sheets, not a single table
    const tableName = fileType === 'CSV' || fileType === 'Parquet' ? stripExtension(importFile.name) : undefined;

    return {
      success: true,
      fileName: importFile.name,
      responsePrompt: response.responsePrompt || `Imported ${importFile.name} into the current sheet`,
      tableName,
    };
  } catch (error) {
    const errorString = error instanceof Error ? error.message : String(error);
    return {
      success: false,
      fileName: importFile.name,
      error: errorString,
    };
  }
}

/**
 * Handle importing Grid files with special logic:
 * - If current file is empty: replace current file contents
 * - If current file is not empty: create a new file and navigate to it
 */
async function handleGridFileImport(importFile: ImportFile, snapshot: any): Promise<ImmediateImportResult> {
  // Check if the current file is empty (all sheets are empty)
  const isFileEmpty = sheets.sheets.every((sheet) => sheet.bounds.type === 'empty');

  // Upgrade the grid file to get its contents
  const gridResult = await quadraticCore.upgradeGridFile(importFile.data, 0);
  if (gridResult.error) {
    return {
      success: false,
      fileName: importFile.name,
      error: gridResult.error,
    };
  }

  if (!gridResult.contents || !gridResult.version) {
    return {
      success: false,
      fileName: importFile.name,
      error: 'Failed to process grid file',
    };
  }

  if (isFileEmpty) {
    // Replace current file by creating a new file with the grid contents and navigating to it
    const teamUuid = await snapshot.getPromise(editorInteractionStateTeamUuidAtom);

    try {
      const name = stripExtension(importFile.name);
      const contents = Buffer.from(gridResult.contents).toString('base64');
      const version = gridResult.version;

      const { file } = await apiClient.files.create({
        file: { name, contents, version },
        teamUuid,
        isPrivate: true,
      });

      // Navigate to the new file
      const searchParams = quadraticCore.receivedClientMessage ? 'negative_offsets' : '';
      window.location.href = ROUTES.FILE({ uuid: file.uuid, searchParams });

      return {
        success: true,
        fileName: importFile.name,
        responsePrompt: `Replaced empty file with contents from ${importFile.name}`,
        navigatedToNewFile: true,
        newFileUuid: file.uuid,
      };
    } catch (error) {
      const errorString = error instanceof Error ? error.message : String(error);
      return {
        success: false,
        fileName: importFile.name,
        error: `Failed to import grid file: ${errorString}`,
      };
    }
  } else {
    // Current file is not empty - create a new file and navigate to it
    const teamUuid = await snapshot.getPromise(editorInteractionStateTeamUuidAtom);

    try {
      const name = stripExtension(importFile.name);
      const contents = Buffer.from(gridResult.contents).toString('base64');
      const version = gridResult.version;

      const { file } = await apiClient.files.create({
        file: { name, contents, version },
        teamUuid,
        isPrivate: true,
      });

      // Navigate to the new file
      const searchParams = quadraticCore.receivedClientMessage ? 'negative_offsets' : '';
      window.location.href = ROUTES.FILE({ uuid: file.uuid, searchParams });

      return {
        success: true,
        fileName: importFile.name,
        responsePrompt: `Created new file "${name}" from ${importFile.name} and navigated to it (current file was not empty)`,
        navigatedToNewFile: true,
        newFileUuid: file.uuid,
      };
    } catch (error) {
      const errorString = error instanceof Error ? error.message : String(error);
      return {
        success: false,
        fileName: importFile.name,
        error: `Failed to create new file from grid: ${errorString}`,
      };
    }
  }
}
