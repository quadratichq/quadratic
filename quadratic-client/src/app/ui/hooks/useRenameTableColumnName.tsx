import { sheets } from '@/app/grid/controller/Sheets';
import type { JsDataTableColumnHeader } from '@/app/quadratic-core-types';
import { validateColumnName } from '@/app/quadratic-core/quadratic_core';
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
      index,
      oldColumnName,
      newColumnName,
      columns,
    }: {
      sheetId: string;
      x: number;
      y: number;
      tableName: string;
      index: number;
      oldColumnName: string;
      newColumnName: string;
      columns: JsDataTableColumnHeader[];
    }) => {
      try {
        validateColumnName(tableName, index, newColumnName, sheets.jsA1Context);
      } catch (error) {
        addGlobalSnackbar(error as string, { severity: 'error' });
        return;
      }

      sheets.updateColumnName(tableName, oldColumnName, newColumnName);
      quadraticCore.dataTableMeta(sheetId, x, y, { columns });
    },
    [addGlobalSnackbar]
  );

  return { renameTableColumnHeader };
}
