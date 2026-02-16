import { aiStore, currentChatMessagesAtom, importFilesToGridAtom } from '@/app/ai/atoms/aiAnalystAtoms';
import { editorInteractionStatePermissionsAtom } from '@/app/atoms/editorInteractionStateAtom';
import { sheets } from '@/app/grid/controller/Sheets';
import { getExtension, getFileTypeFromName } from '@/app/helpers/files';
import type { JsCoordinate } from '@/app/quadratic-core-types';
import { quadraticCore } from '@/app/web-workers/quadraticCore/quadraticCore';
import { filesImportProgressAtom, type FileImportProgress } from '@/dashboard/atoms/filesImportProgressAtom';
import { createInternalImportFilesContent } from 'quadratic-shared/ai/helpers/message.helper';
import type {
  ImportFilesToGridContent,
  InternalImportFile,
  UserMessagePrompt,
} from 'quadratic-shared/typesAndSchemasAI';
import { useRecoilCallback } from 'recoil';

export interface ImportFile {
  name: string;
  size: number;
  data: ArrayBuffer;
}
export const useImportFilesToGrid = () => {
  const importFilesToGrid = useRecoilCallback(
    ({ snapshot, set }) =>
      async ({ importFiles, userMessage }: { importFiles: ImportFile[]; userMessage: UserMessagePrompt }) => {
        if (importFiles.length === 0) {
          return;
        }

        const permissions = await snapshot.getPromise(editorInteractionStatePermissionsAtom);
        if (!permissions.includes('FILE_EDIT')) {
          return;
        }

        aiStore.set(importFilesToGridAtom, { loading: true });

        const currentSheet = sheets.sheet;

        // push excel files to the end of the array
        importFiles.sort((a, b) => {
          const extensionA = getExtension(a.name);
          const extensionB = getExtension(b.name);
          if (['xls', 'xlsx'].includes(extensionA)) return 1;
          if (['xls', 'xlsx'].includes(extensionB)) return -1;
          return 0;
        });

        const importFilesToGridContent: ImportFilesToGridContent = {
          source: 'import_files_to_grid' as const,
          files: [],
        };
        const prevMessages = aiStore.get(currentChatMessagesAtom);
        aiStore.set(currentChatMessagesAtom, [
          ...prevMessages,
          createInternalImportFilesContent(importFilesToGridContent),
        ]);

        // initialize the import progress state
        set(filesImportProgressAtom, {
          importing: true,
          createNewFile: false,
          files: importFiles.map(
            (file): FileImportProgress => ({
              name: file.name,
              size: file.size,
              step: 'read',
              progress: 0,
            })
          ),
        });

        let responsePrompt = 'Files imported:';

        // import files to the grid
        for (const importFile of importFiles) {
          const currentImportFile: InternalImportFile = { fileName: importFile.name, loading: true, error: undefined };
          importFilesToGridContent.files = [...importFilesToGridContent.files, { ...currentImportFile }];
          const currentMessages = aiStore.get(currentChatMessagesAtom);
          aiStore.set(currentChatMessagesAtom, [
            ...currentMessages.slice(0, -1),
            createInternalImportFilesContent(importFilesToGridContent),
          ]);

          // update the current file index
          set(filesImportProgressAtom, (prev) => {
            const currentFileIndex = (prev.currentFileIndex ?? -1) + 1;
            return {
              ...prev,
              currentFileIndex,
            };
          });

          const fileType = getFileTypeFromName(importFile.name);
          if (!fileType || fileType === 'Grid') {
            console.warn(`Unsupported file type: ${importFile.name}`);
            continue;
          }

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
            if (response.responsePrompt) {
              responsePrompt += `\n - ${response.responsePrompt}`;
            }
          } catch (error) {
            console.error('[useImportFilesToGrid] Error importing files to grid', error);
            const errorString = error instanceof Error ? error.message : String(error);
            const errorMessage = `Error importing ${importFile.name}, ${errorString}`;
            currentImportFile.error = errorMessage;
            responsePrompt += `\n - ${errorMessage}`;
          } finally {
            currentImportFile.loading = false;
            importFilesToGridContent.files = [...importFilesToGridContent.files.slice(0, -1), { ...currentImportFile }];
            const msgs = aiStore.get(currentChatMessagesAtom);
            aiStore.set(currentChatMessagesAtom, [
              ...msgs.slice(0, -1),
              createInternalImportFilesContent(importFilesToGridContent),
            ]);
          }
        }

        // reset the import progress state
        set(filesImportProgressAtom, {
          importing: false,
          createNewFile: false,
          files: [],
        });

        aiStore.set(importFilesToGridAtom, { loading: false });

        userMessage.context = {
          ...userMessage.context,
          importFiles: {
            prompt: responsePrompt,
            files: importFiles.map((file) => ({ name: file.name, size: file.size })),
          },
        };
        const finalMessages = aiStore.get(currentChatMessagesAtom);
        aiStore.set(currentChatMessagesAtom, [
          ...finalMessages.slice(0, -2),
          { ...userMessage },
          createInternalImportFilesContent(importFilesToGridContent),
        ]);
      },
    []
  );

  return { importFilesToGrid };
};
