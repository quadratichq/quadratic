import { editorInteractionStateShowGoToMenuAtom } from '@/app/atoms/editorInteractionStateAtom';
import { sheets } from '@/app/grid/controller/Sheets';
import { pixiApp } from '@/app/gridGL/pixiApp/PixiApp';
import { A1Error } from '@/app/quadratic-core-types';
import { stringToSelection } from '@/app/quadratic-rust-client/quadratic_rust_client';
import '@/app/ui/styles/floating-dialog.css';
import { GoToIcon } from '@/shared/components/Icons';
import { Command, CommandInput, CommandItem, CommandList } from '@/shared/shadcn/ui/command';
import React, { useCallback, useMemo } from 'react';
import { useRecoilState } from 'recoil';

export const GoTo = () => {
  const [showGoToMenu, setShowGoToMenu] = useRecoilState(editorInteractionStateShowGoToMenuAtom);

  const [value, setValue] = React.useState<string>('');

  const closeMenu = useCallback(() => {
    setShowGoToMenu(false);
  }, [setShowGoToMenu]);

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
          console.log(error);
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

  if (!showGoToMenu) {
    return null;
  }

  return (
    <Command shouldFilter={false}>
      <CommandInput
        value={value}
        onValueChange={setValue}
        placeholder="Enter a cell “A1” or range “A1:B2”"
        omitIcon={true}
      />
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
      </CommandList>
    </Command>
  );
};
