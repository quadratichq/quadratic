import { shouldAutoSummaryOnImportAtom } from '@/app/atoms/aiAnalystAtom';
import { editorInteractionStateTeamUuidAtom } from '@/app/atoms/editorInteractionStateAtom';
import { sheets } from '@/app/grid/controller/Sheets';
import { supportedFileTypesFromGrid } from '@/app/helpers/files';
import { useFileImport } from '@/app/ui/hooks/useFileImport';
import { useRef } from 'react';
import { useRecoilValue, useSetRecoilState } from 'recoil';

export const FILE_INPUT_ID = 'global-file-input-element';

/**
 * This component is used to handle file uploads for the grid.
 * It is hidden and only used to trigger the system file picker.
 * The picker is triggered by `insertActionsSpec[Action.InsertFile].run()`
 */
export function GridFileInput() {
  const handleFileImport = useFileImport();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const teamUuid = useRecoilValue(editorInteractionStateTeamUuidAtom);
  const setShouldAutoSummary = useSetRecoilState(shouldAutoSummaryOnImportAtom);

  return (
    <input
      id={FILE_INPUT_ID}
      ref={fileInputRef}
      type="file"
      hidden
      accept={supportedFileTypesFromGrid.join(',')}
      onChange={(e) => {
        const files = e.target.files;

        if (files) {
          // Set flag to trigger auto-summary after import
          setShouldAutoSummary(true);

          handleFileImport({
            files: Array.from(files),
            sheetId: sheets.current,
            insertAt: { x: sheets.sheet.cursor.position.x, y: sheets.sheet.cursor.position.y },
            cursor: sheets.getCursorPosition(),
            teamUuid,
          });
        }
      }}
    />
  );
}
