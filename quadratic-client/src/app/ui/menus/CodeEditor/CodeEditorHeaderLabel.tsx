import { codeEditorCodeCellAtom } from '@/app/atoms/codeEditorAtom';
import { editorInteractionStateTeamUuidAtom } from '@/app/atoms/editorInteractionStateAtom';
import { events } from '@/app/events/events';
import { sheets } from '@/app/grid/controller/Sheets';
import { getConnectionUuid } from '@/app/helpers/codeCellLanguage';
import { newSingleSelection, validateTableName } from '@/app/quadratic-core/quadratic_core';
import { useConnectionsFetcher } from '@/app/ui/hooks/useConnectionsFetcher';
import { useRenameTableName } from '@/app/ui/hooks/useRenameTableName';
import { SyncedConnection } from '@/shared/components/connections/SyncedConnection';
import { Input } from '@/shared/shadcn/ui/input';
import { cn } from '@/shared/shadcn/utils';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRecoilValue } from 'recoil';

export function CodeEditorHeaderLabel() {
  const [isRenaming, setIsRenaming] = useState(false);
  const [tableName, setTableName] = useState<string | undefined>(undefined);
  const [cellRef, setCellRef] = useState<string | undefined>(undefined);

  const codeCellState = useRecoilValue(codeEditorCodeCellAtom);
  const teamUuid = useRecoilValue(editorInteractionStateTeamUuidAtom);
  const { connections } = useConnectionsFetcher();

  useEffect(() => {
    const updateCellRef = () => {
      if (!codeCellState.sheetId) return;
      const selection = newSingleSelection(codeCellState.sheetId, codeCellState.pos.x, codeCellState.pos.y);
      const cellRef = selection.toA1String(sheets.current, sheets.jsA1Context);
      setCellRef(cellRef);
    };

    const updateTableName = () => {
      if (!codeCellState.sheetId) return;
      const tableName = sheets.sheet.cursor.getTableNameFromPos(codeCellState);
      setTableName(tableName);
    };

    updateCellRef();
    updateTableName();

    events.on('changeSheet', updateCellRef);
    events.on('sheetInfoUpdate', updateCellRef);
    events.on('a1ContextUpdated', updateTableName);
    return () => {
      events.off('changeSheet', updateCellRef);
      events.off('sheetInfoUpdate', updateCellRef);
      events.off('a1ContextUpdated', updateTableName);
    };
  }, [codeCellState]);

  const focusCellRef = useCallback(() => {
    try {
      if (!cellRef) return;
      const selection = sheets.stringToSelection(cellRef, sheets.current);
      sheets.changeSelection(selection);
    } catch (error) {
      console.error(error);
    }
  }, [cellRef]);

  // Get the connection name (it's possible the user won't have access to it
  // because they're in a file they have access to but not the team — or
  // the connection was deleted)
  const currentConnection = useMemo(() => {
    if (connections.length) {
      const connectionUuid = getConnectionUuid(codeCellState.language);
      const foundConnection = connections.find(({ uuid }) => uuid === connectionUuid);
      if (foundConnection) {
        return foundConnection;
      }
    }
    return undefined;
  }, [codeCellState.language, connections]);

  const { renameTable } = useRenameTableName();

  const handleInput = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      if (e.target instanceof HTMLInputElement) {
        const input = e.target;
        const value = input.value.replace(/ /g, '_').trim();
        input.value = value;
        if (value === tableName) {
          return;
        }

        let isValid = false;
        try {
          isValid = validateTableName(
            value,
            codeCellState.sheetId,
            codeCellState.pos.x,
            codeCellState.pos.y,
            sheets.jsA1Context
          );
        } catch (error) {
          isValid = false;
        }
        input.setAttribute('aria-invalid', (!isValid).toString());
      }
    },
    [codeCellState.pos.x, codeCellState.pos.y, codeCellState.sheetId, tableName]
  );

  const handleBlur = useCallback(
    (e: React.FocusEvent<HTMLInputElement>) => {
      if (e.target instanceof HTMLInputElement) {
        const newName = e.target.value.trim();
        setIsRenaming(false);
        if (newName !== tableName) {
          renameTable({
            sheetId: codeCellState.sheetId,
            x: codeCellState.pos.x,
            y: codeCellState.pos.y,
            oldName: tableName,
            newName,
          });
        }
      }
    },
    [codeCellState.pos.x, codeCellState.pos.y, codeCellState.sheetId, renameTable, tableName]
  );

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.target instanceof HTMLInputElement) {
        if (e.key === 'Enter') {
          setIsRenaming(false);
          const newName = e.target.value.trim();
          if (newName !== tableName) {
            renameTable({
              sheetId: codeCellState.sheetId,
              x: codeCellState.pos.x,
              y: codeCellState.pos.y,
              oldName: tableName,
              newName,
            });
          }
        } else if (e.key === 'Escape') {
          setIsRenaming(false);
        }
      }
    },
    [codeCellState.pos.x, codeCellState.pos.y, codeCellState.sheetId, renameTable, tableName]
  );

  const tableNameDisplayClasses = 'text-sm font-medium leading-4';

  // Single-cell code cells don't have table names, so hide the name section
  const showTableName = !codeCellState.isSingleCell;

  return (
    <div className="ml-1 mr-3 flex flex-grow flex-col gap-0.5 overflow-hidden p-[1px]">
      {showTableName && (
        <div className={cn('flex min-w-0 flex-initial')}>
          {isRenaming ? (
            <Input
              className={cn(
                'h-5 px-1',
                tableNameDisplayClasses,
                'focus-visible:ring-1',
                'aria-[invalid=true]:border-destructive',
                'aria-[invalid=true]:focus-visible:ring-destructive'
              )}
              autoFocus
              defaultValue={tableName}
              onInput={handleInput}
              onBlur={handleBlur}
              onKeyDown={handleKeyDown}
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
      )}

      {!isRenaming && (
        <div
          className={cn(
            'flex min-w-0 max-w-full flex-initial flex-wrap leading-4',
            // Use larger styling when there's no table name (single-cell code cells)
            showTableName ? 'text-xs text-muted-foreground' : tableNameDisplayClasses
          )}
        >
          {currentConnection && (
            <span className="truncate px-1 after:ml-1 after:content-['·']">{currentConnection.name}</span>
          )}
          <button
            className="max-w-full truncate rounded px-1 text-left hover:cursor-pointer hover:bg-accent"
            onClick={focusCellRef}
          >
            {cellRef}
          </button>
          {currentConnection && currentConnection.syncedConnectionUpdatedDate && (
            <span className="px-1">
              · <SyncedConnection connectionUuid={currentConnection.uuid} teamUuid={teamUuid} />
            </span>
          )}
        </div>
      )}
    </div>
  );
}
