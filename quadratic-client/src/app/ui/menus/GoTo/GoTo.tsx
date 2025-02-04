import { editorInteractionStateShowGoToMenuAtom } from '@/app/atoms/editorInteractionStateAtom';
import { events } from '@/app/events/events';
import { sheets } from '@/app/grid/controller/Sheets';
import { pixiApp } from '@/app/gridGL/pixiApp/PixiApp';
import type { A1Error, JsTableInfo } from '@/app/quadratic-core-types';
import { getTableInfo, stringToSelection } from '@/app/quadratic-rust-client/quadratic_rust_client';
import '@/app/ui/styles/floating-dialog.css';
import { GoToIcon } from '@/shared/components/Icons';
import {
  Command,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from '@/shared/shadcn/ui/command';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useRecoilState } from 'recoil';

export const GoTo = () => {
  const [showGoToMenu, setShowGoToMenu] = useRecoilState(editorInteractionStateShowGoToMenuAtom);
  const inputRef = useRef<HTMLInputElement>(null);
  const [value, setValue] = useState<string>();

  const closeMenu = useCallback(() => {
    setShowGoToMenu(false);
  }, [setShowGoToMenu]);

  const [tableInfo, setTablesInfo] = useState<JsTableInfo[]>();
  useEffect(() => {
    const sync = () => {
      const infoStringified = getTableInfo(sheets.a1Context);
      if (infoStringified) {
        try {
          const names = JSON.parse(infoStringified);
          setTablesInfo(names);
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
          <span className="font-bold">A1</span>
        </span>
      );
    }
    try {
      const selection = stringToSelection(value, sheets.current, sheets.a1Context);
      return (
        <span>
          <span className="font-bold">{selection.toA1String(sheets.current, sheets.a1Context)}</span>
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
        const selection = stringToSelection(value, sheets.current, sheets.a1Context);
        sheets.changeSelection(selection);
      } catch (_) {
        // nothing to do if we can't parse the input
      }
    }
    closeMenu();
  }, [closeMenu, value]);

  const selectTable = useCallback(
    (tableName: string) => {
      const selection = stringToSelection(tableName, sheets.current, sheets.a1Context);
      sheets.changeSelection(selection);
      closeMenu();
    },
    [closeMenu]
  );

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
      </div>
      <CommandList className="">
        <CommandGroup heading="Go to" className="border-b border-b-border">
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
        </CommandGroup>
        {/* <CommandItem className="flex cursor-pointer items-center justify-between">
          <div>Rename range {convertedInput}</div>
        </CommandItem> */}

        <CommandGroup heading="Tables">
          {tableInfo?.map(({ name, sheet_name }) => (
            <CommandItem key={name} onSelect={() => selectTable(name)} className="flex items-center justify-between">
              <div className="">{name}</div>
              <div className="text-xs text-muted-foreground">{sheet_name}</div>
            </CommandItem>
          ))}
        </CommandGroup>
        <CommandSeparator />
      </CommandList>
    </Command>
  );
};
