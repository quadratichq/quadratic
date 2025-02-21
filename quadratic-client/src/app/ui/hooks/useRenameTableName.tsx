import { sheets } from '@/app/grid/controller/Sheets';
import { validateTableName } from '@/app/quadratic-rust-client/quadratic_rust_client';
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
        validateTableName(newName, sheets.a1Context);
      } catch (error) {
        addGlobalSnackbar(error as string, { severity: 'error' });
        return;
      }

      if (oldName !== undefined) {
        sheets.updateTableName(oldName, newName);
      }

      quadraticCore.dataTableMeta(sheetId, x, y, { name: newName }, sheets.getCursorPosition());
    },
    [addGlobalSnackbar]
  );

  return { renameTable };
}
