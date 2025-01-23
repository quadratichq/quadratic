import { codeEditorCodeCellAtom } from '@/app/atoms/codeEditorAtom';
import { events } from '@/app/events/events';
import { sheets } from '@/app/grid/controller/Sheets';
import { getConnectionUuid } from '@/app/helpers/codeCellLanguage';
import { getTableNameFromPos, stringToSelection, xyToA1 } from '@/app/quadratic-rust-client/quadratic_rust_client';
import { useConnectionsFetcher } from '@/app/ui/hooks/useConnectionsFetcher';
import { quadraticCore } from '@/app/web-workers/quadraticCore/quadraticCore';
import { useGlobalSnackbar } from '@/shared/components/GlobalSnackbarProvider';
import { Input } from '@/shared/shadcn/ui/input';
import { cn } from '@/shared/shadcn/utils';
import { useEffect, useMemo, useState } from 'react';
import { useRecoilValue } from 'recoil';

export function CodeEditorHeaderLabel() {
  const [isRenaming, setIsRenaming] = useState(true);
  const codeCellState = useRecoilValue(codeEditorCodeCellAtom);
  const [currentSheetId, setCurrentSheetId] = useState<string>(sheets.sheet.id);
  const connectionsFetcher = useConnectionsFetcher();

  // TODO: (ayush) wire this up however we do it (see hook function below)
  const renameTable = useRenameTableName({
    sheetId: codeCellState.sheetId,
    x: codeCellState.pos.x,
    y: codeCellState.pos.y,
  });

  const a1Pos = xyToA1(codeCellState.pos.x, codeCellState.pos.y);
  // TODO: (ayush) table name is not updating when we rename a table
  const tableName = getTableNameFromPos(
    sheets.a1Context,
    codeCellState.sheetId,
    codeCellState.pos.x,
    codeCellState.pos.y
  );

  // Get the connection name (it's possible the user won't have access to it
  // because they're in a file they have access to but not the team — or
  // the connection was deleted)
  const currentConnectionName = useMemo(() => {
    if (connectionsFetcher.data) {
      const connectionUuid = getConnectionUuid(codeCellState.language);
      const foundConnection = connectionsFetcher.data.connections.find(({ uuid }) => uuid === connectionUuid);
      if (foundConnection) {
        return foundConnection.name;
      }
    }
    return '';
  }, [codeCellState.language, connectionsFetcher.data]);

  // Keep track of the current sheet ID so we know whether to show the sheet name or not
  const currentCodeEditorCellIsNotInActiveSheet = useMemo(
    () => currentSheetId !== codeCellState.sheetId,
    [currentSheetId, codeCellState.sheetId]
  );
  // TODO: (ayush) sheetId isn't updating here when we rename a sheet?
  const currentSheetNameOfActiveCodeEditorCell = useMemo(
    () => sheets.getById(codeCellState.sheetId)?.name,
    [codeCellState.sheetId]
  );

  useEffect(() => {
    const updateSheetName = () => setCurrentSheetId(sheets.sheet.id);
    events.on('changeSheet', updateSheetName);
    return () => {
      events.off('changeSheet', updateSheetName);
    };
  }, []);

  // Create the cell reference, which can vary based on what the user is viewing
  // Either `A1` or `Sheet1!A1` or `'Sheet 1'!A1`
  let cellRef = a1Pos;
  if (currentCodeEditorCellIsNotInActiveSheet && currentSheetNameOfActiveCodeEditorCell) {
    cellRef = currentSheetNameOfActiveCodeEditorCell?.includes(' ')
      ? `'${currentSheetNameOfActiveCodeEditorCell}'!${cellRef}`
      : `${currentSheetNameOfActiveCodeEditorCell}!${cellRef}`;
  }

  const tableNameDisplayClasses = 'text-sm font-medium leading-4';

  return (
    <div className="ml-1 mr-3 flex flex-grow flex-col gap-0.5 overflow-hidden p-[1px]">
      <div className={cn('flex min-w-0 flex-initial')}>
        {isRenaming ? (
          <Input
            className={cn('h-5 px-1', tableNameDisplayClasses)}
            autoFocus
            defaultValue={tableName}
            onBlur={(e) => {
              const value = e.target.value;
              setIsRenaming(false);
              renameTable(value);
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                setIsRenaming(false);
                renameTable((e.target as HTMLInputElement).value);
              }
            }}
          />
        ) : (
          <button
            onClick={() => setIsRenaming(true)}
            className={cn(
              'max-w-full truncate rounded px-1 text-left',
              tableName ? 'hover:cursor-pointer hover:bg-accent' : 'text-muted-foreground',
              tableNameDisplayClasses
            )}
            disabled={!tableName}
          >
            {tableName ? tableName : '[Untitled]'}
          </button>
        )}
      </div>

      {!isRenaming && (
        <div className="flex min-w-0 flex-initial text-xs leading-4 text-muted-foreground">
          <button
            className="max-w-full truncate rounded px-1 text-left hover:cursor-pointer hover:bg-accent"
            onClick={() => {
              const selection = stringToSelection(cellRef, sheets.sheet.id, sheets.a1Context);
              sheets.changeSelection(selection);
            }}
          >
            {cellRef}
          </button>
          {currentConnectionName && (
            <>
              {' · '}
              {currentConnectionName}
            </>
          )}
        </div>
      )}
    </div>
  );
}

// TODO: (ayush) wire this up to core however we want to do it, whether we validate
// here, or core does it and we catch errors and display them
function useRenameTableName({ sheetId, x, y }: { sheetId: string; x: number; y: number }) {
  const { addGlobalSnackbar } = useGlobalSnackbar();

  const renameTable = (name: string) => {
    let trimmedName = name.trim();

    if (trimmedName.length === 0) {
      addGlobalSnackbar('Name cannot be empty', { severity: 'error' });
      return '';
    }
    if (trimmedName.length > 255) {
      addGlobalSnackbar('Name cannot be longer than 255 characters', { severity: 'error' });
      return '';
    }

    // Core will: convert spaces to underscores, strip special characters, and check for uniqueness
    quadraticCore.dataTableMeta(
      sheetId,
      x,
      y,
      { name: trimmedName }
      // TODO: do we need to pass this?
      // sheets.getCursorPosition()
    );
  };

  return renameTable;
}
