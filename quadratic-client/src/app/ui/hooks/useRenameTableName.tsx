import { sheets } from '@/app/grid/controller/Sheets';
import { validateTableName } from '@/app/quadratic-rust-client/quadratic_rust_client';
import { quadraticCore } from '@/app/web-workers/quadraticCore/quadraticCore';
import { useGlobalSnackbar } from '@/shared/components/GlobalSnackbarProvider';
import { useCallback } from 'react';

export function useRenameTableName() {
  const { addGlobalSnackbar } = useGlobalSnackbar();

  const renameTable = useCallback(
    ({ sheetId, x, y, name }: { sheetId: string; x: number; y: number; name: string }) => {
      name = name.trim();

      try {
        validateTableName(name, sheets.a1Context);
      } catch (error) {
        addGlobalSnackbar(error as string, { severity: 'error' });
        return;
      }

      quadraticCore.dataTableMeta(sheetId, x, y, { name }, sheets.getCursorPosition());
    },
    [addGlobalSnackbar]
  );

  return { renameTable };
}
