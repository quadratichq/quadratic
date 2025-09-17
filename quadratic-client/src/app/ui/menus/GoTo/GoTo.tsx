import '@/app/ui/styles/floating-dialog.css';

import { editorInteractionStateShowGoToMenuAtom } from '@/app/atoms/editorInteractionStateAtom';
import { tableInfoAtom } from '@/app/atoms/tableInfoAtom';
import { sheets } from '@/app/grid/controller/Sheets';
import { getConnectionKind } from '@/app/helpers/codeCellLanguage';
import type { A1Error } from '@/app/quadratic-core-types';
import { CloseIcon, GoToIcon } from '@/shared/components/Icons';
import { LanguageIcon } from '@/shared/components/LanguageIcon';
import { Command, CommandGroup, CommandInput, CommandItem, CommandList } from '@/shared/shadcn/ui/command';
import { cn } from '@/shared/shadcn/utils';
import { CommandSeparator } from 'cmdk';
import { memo, useCallback, useMemo, useRef, useState } from 'react';
import { useRecoilValue, useSetRecoilState } from 'recoil';

type Props = {
  // Passes back a string representing a reference for the user's selection.
  // Could be:
  //   - A cell ("A1")
  //   - A range ("A1:B2")
  //   - A code/table name ("Python1")
  //   - A sheet name ("Sheet1")
  //   - A user-defined input string ("foobar391.dke")
  // Consumers should handle each of these cases, as we don't guarantee a valid
  // reference to _something_ in the sheet.
  onSelect: (referenceString: string) => void;
  reverse?: boolean;
};

export const GoTo = memo((props: Props) => {
  const { reverse, onSelect } = props;
  const inputRef = useRef<HTMLInputElement>(null);
  const setShowGoToMenu = useSetRecoilState(editorInteractionStateShowGoToMenuAtom);
  const [value, setValue] = useState<string>('');
  const tableInfo = useRecoilValue(tableInfoAtom);
  const [activeFilter, setActiveFilter] = useState('');

  const closeMenu = useCallback(() => {
    console.log('closeMenu');
    setShowGoToMenu(false);
  }, [setShowGoToMenu]);

  const tableNameToRange = useCallback((tableName: string): string => {
    let range = '';
    try {
      range = sheets.convertTableToRange(tableName, sheets.current);
    } catch (e) {
      console.error('Error getting table name range in GoTo.tsx', e);
    }
    return range;
  }, []);

  const convertedInput = useMemo(() => {
    if (!value) {
      return 'A1';
    }
    try {
      const selection = sheets.stringToSelection(value, sheets.current);
      return selection.toA1String(sheets.current, sheets.jsA1Context);
    } catch (e: any) {
      if (e) {
        try {
          const error: A1Error | undefined = JSON.parse(e);
          if (error?.type === 'InvalidSheetName') {
            return `Sheet “${error.error}” not found`;
          } else if (error?.type === 'InvalidColumn') {
            return `Column “${error.error}” is out of bounds`;
          } else if (error?.type === 'InvalidRow') {
            return `Row “${error.error}” is out of bounds`;
          } else if (error?.type === 'TooManySheets') {
            return 'Only one sheet is supported';
          }
        } catch (_) {}
      }
      return 'Invalid input';
    }
  }, [value]);

  const handleOnSelect = useCallback(
    (referenceString: string): void => {
      onSelect(referenceString === '' ? 'A1' : referenceString);
      closeMenu();
    },
    [closeMenu, onSelect]
  );

  const tablesFiltered = useMemo(
    () =>
      tableInfo
        ? tableInfo.filter(({ name, language }) => {
            if (language !== 'Import') {
              return false;
            }

            return value ? name.toLowerCase().includes(value.toLowerCase()) : true;
          })
        : [],
    [tableInfo, value]
  );

  const codeTablesFiltered = useMemo(
    () =>
      tableInfo
        ? tableInfo.filter(({ name, language }) => {
            if (language === 'Formula' || language === 'Import') {
              return false;
            }
            return value ? name.toLowerCase().includes(value.toLowerCase()) : true;
          })
        : [],
    [tableInfo, value]
  );

  const sheetsFiltered = useMemo(
    () =>
      sheets
        .map((sheet) => sheet)
        .filter((sheet) => {
          return value ? sheet.name.toLowerCase().includes(value.toLowerCase()) : true;
        }),
    [value]
  );

  const filters = useMemo(() => {
    return [
      ['In this sheet', 4],
      ['Tables', tablesFiltered.length],
      ['Code', codeTablesFiltered.length],
      ['Sheets', sheetsFiltered.length],
    ];
  }, [tablesFiltered, codeTablesFiltered, sheetsFiltered]);

  return (
    <Command
      shouldFilter={false}
      data-testid="goto-menu"
      className={cn(
        // TODO: this doesn't work — breaks arrow keys
        reverse && 'flex flex-col-reverse [&_[cmdk-list-sizer]]:flex [&_[cmdk-list-sizer]]:flex-col-reverse'
      )}
    >
      <div className={cn('flex w-full items-center justify-between', false && 'order-last border-t border-border')}>
        <div className="relative w-full flex-grow">
          <div className="flex flex-wrap items-center gap-1 px-3 pt-1.5 text-xs text-muted-foreground">
            {filters.map(([filter, count], i) =>
              count === 0 ? null : (
                <button
                  className={cn(
                    'flex items-center gap-0.5 font-medium',
                    'cursor-pointer rounded-md border px-1.5 py-0.5',
                    filter === activeFilter
                      ? 'border-primary bg-primary text-primary-foreground'
                      : 'border-border text-muted-foreground'
                  )}
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    setActiveFilter(filter === activeFilter ? '' : (filter as string));
                    inputRef.current?.focus();
                  }}
                >
                  {filter} {filter !== '' && <span className="font-normal">({count})</span>}
                  {filter === activeFilter && filter !== '' && (
                    <CloseIcon size="sm" className="ml-1 !h-4 !w-4 -translate-y-0.5 !text-sm" />
                  )}
                </button>
              )
            )}
          </div>
          <CommandInput
            ref={inputRef}
            value={value}
            onValueChange={setValue}
            placeholder="Enter a cell “A1”, range “A1:B2”, or name “Python1”"
            omitIcon={true}
            autoFocus
            onClick={(e) => {
              e.stopPropagation();
            }}
          />
        </div>
      </div>

      <CommandList className={cn('', false && 'order-first')}>
        {activeFilter === '' && (
          <CommandGroup heading={'Cell / range'} className="border-b border-b-border">
            <CommandItem
              onSelect={() => handleOnSelect(value)}
              className="flex cursor-pointer items-center justify-between"
              onPointerDown={(e) => {
                e.preventDefault();
                e.stopPropagation();
              }}
            >
              {convertedInput ? <div>{convertedInput}</div> : null}
              {!reverse && <GoToIcon className="text-muted-foreground" />}
            </CommandItem>
          </CommandGroup>
        )}

        {tablesFiltered.length > 0 && (activeFilter === 'Tables' || activeFilter === '') && (
          <>
            <CommandGroup heading="Tables">
              {tablesFiltered.map(({ name }, i) => (
                <CommandItemGoto
                  key={name}
                  value={name}
                  onSelect={() => handleOnSelect(name)}
                  name={name}
                  nameSecondary={tableNameToRange(name)}
                />
              ))}
            </CommandGroup>
            <CommandSeparator />
          </>
        )}

        {codeTablesFiltered.length > 0 && (activeFilter === 'Code' || activeFilter === '') && (
          <CommandGroup heading="Code">
            {codeTablesFiltered.map(({ name, language }, i) => (
              <CommandItemGoto
                key={name}
                value={name}
                onSelect={() => handleOnSelect(name)}
                name={name}
                nameSecondary={tableNameToRange(name)}
                icon={<LanguageIcon language={getConnectionKind(language)} />}
              />
            ))}
          </CommandGroup>
        )}

        {sheetsFiltered.length > 0 && (activeFilter === 'Sheets' || activeFilter === '') && (
          <CommandGroup heading="Sheets">
            {sheetsFiltered.map((sheet) => (
              <CommandItemGoto
                key={sheet.id}
                value={sheet.id}
                onSelect={() => handleOnSelect(sheet.name)}
                name={sheet.name}
                nameSecondary={sheet.id === sheets.current ? '(current)' : ''}
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
