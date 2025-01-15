import { sheets } from '@/app/grid/controller/Sheets';
import { supportedFileTypesFromGrid } from '@/app/helpers/files';
import { useFileImport } from '@/app/ui/hooks/useFileImport';
import { useFileRouteLoaderData } from '@/shared/hooks/useFileRouteLoaderData';
import { useRef } from 'react';

export const FILE_INPUT_ID = 'global-file-input-element';

/**
 * This component is used to handle file uploads for the grid.
 * It is hidden and only used to trigger the system file picker.
 * The picker is triggered by `insertActionsSpec[Action.InsertFile].run()`
 */
export function GridFileInput() {
  const handleFileImport = useFileImport();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const {
    team: { uuid: teamUuid },
  } = useFileRouteLoaderData();

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
          handleFileImport({
            files: Array.from(files),
            sheetId: sheets.sheet.id,
            insertAt: { x: sheets.sheet.cursor.position.x, y: sheets.sheet.cursor.position.y },
            cursor: sheets.getCursorPosition(),
            teamUuid,
          });
        }
      }}
    />
  );
}
