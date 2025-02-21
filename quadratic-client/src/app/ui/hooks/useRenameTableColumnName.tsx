import { sheets } from '@/app/grid/controller/Sheets';
import { validateColumnName } from '@/app/quadratic-rust-client/quadratic_rust_client';
import { quadraticCore } from '@/app/web-workers/quadraticCore/quadraticCore';
import { useGlobalSnackbar } from '@/shared/components/GlobalSnackbarProvider';
import { useCallback } from 'react';

export function useRenameTableColumnName() {
  const { addGlobalSnackbar } = useGlobalSnackbar();

  const renameTableColumnHeader = useCallback(
    ({
      sheetId,
      x,
      y,
      tableName,
      oldColumnName,
      newColumnName,
      columns,
    }: {
      sheetId: string;
      x: number;
      y: number;
      tableName: string;
      oldColumnName: string;
      newColumnName: string;
      columns: { name: string; display: boolean; valueIndex: number }[];
    }) => {
      try {
        validateColumnName(tableName, newColumnName, sheets.a1Context);
      } catch (error) {
        addGlobalSnackbar(error as string, { severity: 'error' });
        return;
      }

      const cursor = sheets.getCursorPosition();
      sheets.updateColumnName(tableName, oldColumnName, newColumnName);
      quadraticCore.dataTableMeta(sheetId, x, y, { columns }, cursor);
    },
    [addGlobalSnackbar]
  );

  return { renameTableColumnHeader };
}
