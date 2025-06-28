import { sheets } from '@/app/grid/controller/Sheets';
import { validateTableName } from '@/app/quadratic-core/quadratic_core';
import { quadraticCore } from '@/app/web-workers/quadraticCore/quadraticCore';
import { useGlobalSnackbar } from '@/shared/components/GlobalSnackbarProvider';
import { useCallback } from 'react';

export function useRenameTableName() {
  const { addGlobalSnackbar } = useGlobalSnackbar();

  const renameTable = useCallback(
    ({
      sheetId,
      x,
      y,
      oldName,
      newName,
    }: {
      sheetId: string;
      x: number;
      y: number;
      oldName: string | undefined;
      newName: string;
    }) => {
      newName = newName.trim();

      try {
        validateTableName(newName, sheetId, x, y, sheets.jsA1Context);
      } catch (error) {
        addGlobalSnackbar(error as string, { severity: 'error' });
        return;
      }

      const cursor = sheets.getCursorPosition();
      if (oldName !== undefined) {
        sheets.updateTableName(oldName, newName);
      }
      quadraticCore.dataTableMeta(sheetId, x, y, { name: newName }, cursor);
    },
    [addGlobalSnackbar]
  );

  return { renameTable };
}
