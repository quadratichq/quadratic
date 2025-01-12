import { editorInteractionStateShowGoToMenuAtom } from '@/app/atoms/editorInteractionStateAtom';
import { events } from '@/app/events/events';
import { sheets } from '@/app/grid/controller/Sheets';
import { pixiApp } from '@/app/gridGL/pixiApp/PixiApp';
import type { A1Error } from '@/app/quadratic-core-types';
import { getTableNames, stringToSelection } from '@/app/quadratic-rust-client/quadratic_rust_client';
import '@/app/ui/styles/floating-dialog.css';
import { ArrowDropDownIcon, EditIcon, GoToIcon } from '@/shared/components/Icons';
import { Button } from '@/shared/shadcn/ui/button';
import { Command, CommandInput, CommandItem, CommandList } from '@/shared/shadcn/ui/command';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/shared/shadcn/ui/tooltip';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useRecoilState } from 'recoil';

export const GoTo = () => {
  const [showGoToMenu, setShowGoToMenu] = useRecoilState(editorInteractionStateShowGoToMenuAtom);
  const [pages, setPages] = useState<string[]>([]);
  const page = pages[pages.length - 1];

  const [value, setValue] = useState<string>('');

  const closeMenu = useCallback(() => {
    setShowGoToMenu(false);
  }, [setShowGoToMenu]);

  const [tableNames, setTablesNames] = useState<string[]>();
  useEffect(() => {
    const sync = () => {
      const namesStringified = getTableNames(sheets.a1Context);
      if (namesStringified) {
        try {
          const names = JSON.parse(namesStringified);
          setTablesNames(names);
        } catch (e) {
          console.error(e);
        }
      }
    };
    sync();
    events.on('updateCodeCell', sync);
    events.on('renderCodeCells', sync);
    return () => {
      events.off('updateCodeCell', sync);
      events.off('renderCodeCells', sync);
    };
  }, []);

  const convertedInput = useMemo(() => {
    if (!value) {
      return (
        <span>
          Go to <span className="font-bold">A1</span>
        </span>
      );
    }
    try {
      const selection = stringToSelection(value, sheets.current, sheets.a1Context);
      return (
        <span>
          Go to <span className="font-bold">{selection.toA1String(sheets.current, sheets.a1Context)}</span>
        </span>
      );
    } catch (e: any) {
      if (e) {
        try {
          const error: A1Error | undefined = JSON.parse(e);
          if (error?.type === 'InvalidSheetName') {
            return (
              <span>
                Sheet <span className="font-bold">{error.error}</span> not found
              </span>
            );
          } else if (error?.type === 'InvalidColumn') {
            return <span>Column {error.error} is out of bounds</span>;
          } else if (error?.type === 'InvalidRow') {
            return <span>Row {error.error} is out of bounds</span>;
          } else if (error?.type === 'TooManySheets') {
            return <span>Only one sheet is supported</span>;
          }
        } catch (_) {}
      }
      return 'Invalid input';
    }
  }, [value]);

  const onSelect = useCallback(() => {
    // if empty, then move cursor to A1
    if (!value) {
      sheets.sheet.cursor.moveTo(1, 1);
      pixiApp.viewport.reset();
    } else {
      try {
        const selection = stringToSelection(value, sheets.sheet.id, sheets.a1Context);
        sheets.changeSelection(selection);
      } catch (_) {
        // nothing to do if we can't parse the input
      }
    }
    closeMenu();
  }, [closeMenu, value]);

  const selectTable = useCallback(
    (tableName: string) => {
      setPages([]);
      const selection = stringToSelection(tableName, sheets.sheet.id, sheets.a1Context);
      sheets.changeSelection(selection);
      closeMenu();
    },
    [setPages, closeMenu]
  );

  const inputRef = useRef<HTMLInputElement>(null);
  const editCurrentValue = useCallback(() => {
    setValue(sheets.sheet.cursor.toA1String());
    inputRef.current?.focus();
    inputRef.current?.select();
  }, []);

  if (!showGoToMenu) {
    return null;
  }

  return (
    <Command shouldFilter={false}>
      <div className="flex w-full items-center justify-between">
        <div className="w-full flex-grow">
          <CommandInput
            ref={inputRef}
            value={value}
            onValueChange={setValue}
            placeholder="Enter a cell “A1” or range “A1:B2”"
            omitIcon={true}
          />
        </div>
        <Tooltip>
          <TooltipTrigger asChild className="flex-grow-0">
            <Button variant="ghost" onClick={editCurrentValue}>
              <EditIcon />
            </Button>
          </TooltipTrigger>
          <TooltipContent>Edit current selection</TooltipContent>
        </Tooltip>
      </div>
      <CommandList className="p-2">
        <CommandItem
          onSelect={onSelect}
          className="flex cursor-pointer items-center justify-between"
          onPointerDown={(e) => {
            e.preventDefault();
            e.stopPropagation();
          }}
        >
          {convertedInput ? <div>{convertedInput}</div> : null}
          <GoToIcon className="text-muted-foreground" />
        </CommandItem>
        {/* <CommandItem className="flex cursor-pointer items-center justify-between">
          <div>Rename range {convertedInput}</div>
        </CommandItem> */}
        {!page && (
          <CommandItem
            className="mt-2 pt-2"
            style={{ borderTop: '2px solid hsl(var(--primary-foreground))' }}
            onSelect={() => setPages([...pages, 'tables'])}
          >
            <div className="flex w-full items-center justify-between">
              <div>Select table</div>
              <ArrowDropDownIcon className="text-muted-foreground group-hover:text-foreground" />
            </div>
          </CommandItem>
        )}
        {page === 'tables' && (
          <>
            <CommandItem
              className="mt-2 pt-2"
              style={{ borderTop: '2px solid hsl(var(--primary-foreground))' }}
              onSelect={() => setPages(pages.filter((s) => s !== 'tables'))}
            >
              <div className="flex w-full items-center justify-between">
                <div>Select table</div>
                <ArrowDropDownIcon className="text-muted-foreground group-hover:text-foreground" />
              </div>
            </CommandItem>
            {tableNames?.map((name) => (
              <CommandItem key={name} onSelect={() => selectTable(name)}>
                <div className="ml-3 font-bold">{name}</div>
              </CommandItem>
            ))}
          </>
        )}
      </CommandList>
    </Command>
  );
};
