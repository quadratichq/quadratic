import { codeEditorCodeCellAtom } from '@/app/atoms/codeEditorAtom';
import { events } from '@/app/events/events';
import { sheets } from '@/app/grid/controller/Sheets';
import { getConnectionUuid } from '@/app/helpers/codeCellLanguage';
import {
  getTableNameFromPos,
  newSingleSelection,
  stringToSelection,
  validateTableName,
} from '@/app/quadratic-rust-client/quadratic_rust_client';
import { useConnectionsFetcher } from '@/app/ui/hooks/useConnectionsFetcher';
import { useRenameTableName } from '@/app/ui/hooks/useRenameTableName';
import { Input } from '@/shared/shadcn/ui/input';
import { cn } from '@/shared/shadcn/utils';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRecoilValue } from 'recoil';

export function CodeEditorHeaderLabel() {
  const [isRenaming, setIsRenaming] = useState(false);
  const [tableName, setTableName] = useState<string | undefined>(undefined);
  const [cellRef, setCellRef] = useState<string | undefined>(undefined);

  const codeCellState = useRecoilValue(codeEditorCodeCellAtom);
  const connectionsFetcher = useConnectionsFetcher();

  useEffect(() => {
    const updateCellRef = () => {
      if (!codeCellState.sheetId) return;
      const selection = newSingleSelection(codeCellState.sheetId, codeCellState.pos.x, codeCellState.pos.y);
      const cellRef = selection.toA1String(sheets.current, sheets.a1Context);
      setCellRef(cellRef);
    };

    const updateTableName = (a1Context: string) => {
      if (!codeCellState.sheetId) return;
      const tableName = getTableNameFromPos(a1Context, codeCellState.sheetId, codeCellState.pos.x, codeCellState.pos.y);
      setTableName(tableName);
    };

    updateCellRef();
    updateTableName(sheets.a1Context);

    events.on('changeSheet', updateCellRef);
    events.on('sheetInfoUpdate', updateCellRef);
    events.on('a1Context', updateTableName);
    return () => {
      events.off('changeSheet', updateCellRef);
      events.off('sheetInfoUpdate', updateCellRef);
      events.off('a1Context', updateTableName);
    };
  }, [codeCellState.pos.x, codeCellState.pos.y, codeCellState.sheetId]);

  const focusCellRef = useCallback(() => {
    if (!cellRef) return;
    const selection = stringToSelection(cellRef, sheets.current, sheets.a1Context);
    sheets.changeSelection(selection);
  }, [cellRef]);

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
          isValid = validateTableName(value, sheets.a1Context);
        } catch (error) {
          isValid = false;
        }
        input.setAttribute('aria-invalid', (!isValid).toString());
      }
    },
    [tableName]
  );

  const handleBlur = useCallback(
    (e: React.FocusEvent<HTMLInputElement>) => {
      if (e.target instanceof HTMLInputElement) {
        const name = e.target.value.trim();
        setIsRenaming(false);
        if (name !== tableName) {
          renameTable({ sheetId: codeCellState.sheetId, x: codeCellState.pos.x, y: codeCellState.pos.y, name });
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
          const name = e.target.value.trim();
          if (name !== tableName) {
            renameTable({ sheetId: codeCellState.sheetId, x: codeCellState.pos.x, y: codeCellState.pos.y, name });
          }
        } else if (e.key === 'Escape') {
          setIsRenaming(false);
        }
      }
    },
    [codeCellState.pos.x, codeCellState.pos.y, codeCellState.sheetId, renameTable, tableName]
  );

  const tableNameDisplayClasses = 'text-sm font-medium leading-4';

  return (
    <div className="ml-1 mr-3 flex flex-grow flex-col gap-0.5 overflow-hidden p-[1px]">
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

      {!isRenaming && (
        <div className="flex min-w-0 flex-initial text-xs leading-4 text-muted-foreground">
          <button
            className="max-w-full truncate rounded px-1 text-left hover:cursor-pointer hover:bg-accent"
            onClick={focusCellRef}
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
