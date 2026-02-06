import '@/app/ui/styles/floating-dialog.css';

import { editorInteractionStateShowGoToMenuAtom } from '@/app/atoms/editorInteractionStateAtom';
import { sheets } from '@/app/grid/controller/Sheets';
import { pixiApp } from '@/app/gridGL/pixiApp/PixiApp';
import { getConnectionKind } from '@/app/helpers/codeCellLanguage';
import { focusGrid } from '@/app/helpers/focusGrid';
import type { A1Error } from '@/app/quadratic-core-types';
import { useGetGridItems } from '@/app/ui/hooks/useGetGridItems';
import { GoToIcon } from '@/shared/components/Icons';
import { LanguageIcon } from '@/shared/components/LanguageIcon';
import { Command, CommandGroup, CommandInput, CommandItem, CommandList } from '@/shared/shadcn/ui/command';
import { CommandSeparator } from 'cmdk';
import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useSetRecoilState } from 'recoil';

export const GoTo = memo(() => {
  const inputRef = useRef<HTMLInputElement>(null);
  const setShowGoToMenu = useSetRecoilState(editorInteractionStateShowGoToMenuAtom);
  const [value, setValue] = useState<string>('');
  const [currentSheet, setCurrentSheet] = useState<string>(sheets.current);
  const { tablesFiltered, codeTablesFiltered, sheetsFiltered } = useGetGridItems(value);

  const closeMenu = useCallback(() => {
    setShowGoToMenu(false);
  }, [setShowGoToMenu]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        e.stopPropagation();
        closeMenu();
        // Use setTimeout to ensure the menu state has updated before focusing
        setTimeout(() => {
          focusGrid();
        }, 0);
      }
    },
    [closeMenu]
  );

  const convertedInput = useMemo(() => {
    if (!value) {
      return (
        <span>
          <span className="font-bold">A1</span>
        </span>
      );
    }
    try {
      const selection = sheets.stringToSelection(value, sheets.current);
      return (
        <span>
          <span className="font-bold">{selection.toA1String(sheets.current, sheets.jsA1Context)}</span>
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
      sheets.sheet.cursor.moveTo(1, 1, { checkForTableRef: true });
      pixiApp.viewport.reset();
    } else {
      try {
        const selection = sheets.stringToSelection(value, sheets.current);
        sheets.changeSelection(selection);
      } catch (_) {
        // nothing to do if we can't parse the input
      }
    }
    closeMenu();
  }, [closeMenu, value]);

  const selectTable = useCallback(
    (tableName: string) => {
      const selection = sheets.stringToSelection(tableName, sheets.current);
      sheets.changeSelection(selection);
      closeMenu();
    },
    [closeMenu]
  );

  const selectSheet = useCallback(
    (sheetId: string) => {
      setCurrentSheet(sheetId);
      closeMenu();
    },
    [closeMenu]
  );

  useEffect(() => {
    if (currentSheet !== sheets.current) {
      sheets.current = currentSheet;
    }
  }, [currentSheet]);

  return (
    <Command shouldFilter={false} data-testid="goto-menu">
      <div className="flex w-full items-center justify-between">
        <div className="relative w-full flex-grow">
          <CommandInput
            ref={inputRef}
            value={value}
            onValueChange={setValue}
            onKeyDown={handleKeyDown}
            placeholder='Enter a cell "A1" or range "A1:B2"'
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

        {tablesFiltered.length > 0 && (
          <>
            <CommandGroup heading="Tables">
              {tablesFiltered.map(({ name }, i) => (
                <CommandItemGoto
                  key={name}
                  value={name}
                  onSelect={() => selectTable(name)}
                  name={name}
                  nameSecondary={tableNameToRange(name)}
                />
              ))}
            </CommandGroup>
            <CommandSeparator />
          </>
        )}

        {codeTablesFiltered.length > 0 && (
          <CommandGroup heading="Code">
            {codeTablesFiltered.map(({ name, language }, i) => (
              <CommandItemGoto
                key={name}
                value={name}
                onSelect={() => selectTable(name)}
                name={name}
                nameSecondary={tableNameToRange(name)}
                icon={<LanguageIcon language={getConnectionKind(language)} />}
              />
            ))}
          </CommandGroup>
        )}

        {sheetsFiltered.length > 0 && (
          <CommandGroup heading="Sheets">
            {sheetsFiltered.map((sheet) => (
              <CommandItemGoto
                key={sheet.id}
                value={sheet.id}
                onSelect={() => selectSheet(sheet.id)}
                name={sheet.name}
              />
            ))}
          </CommandGroup>
        )}
      </CommandList>
    </Command>
  );
});

const CommandItemGoto = memo(
  ({
    value,
    onSelect,
    icon,
    name,
    nameSecondary,
  }: {
    value: string;
    onSelect: () => void;
    icon?: React.ReactNode;
    name: string;
    nameSecondary?: string;
  }) => {
    return (
      <CommandItem value={value} onSelect={onSelect} className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 overflow-hidden">
          {icon}
          <p className="truncate">{name}</p>
        </div>

        {nameSecondary && (
          <div className="max-w-[30%] flex-shrink-0 truncate text-right text-xs text-muted-foreground">
            {nameSecondary}
          </div>
        )}
      </CommandItem>
    );
  }
);

export function tableNameToRange(tableName: string) {
  let range = '';

  try {
    range = sheets.convertTableToRange(tableName, sheets.current);
  } catch {
    // Expected during navigation when sheet context changes - silently return empty string
  }

  return range;
}
