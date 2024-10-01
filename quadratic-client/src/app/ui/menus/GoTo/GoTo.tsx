/* eslint-disable @typescript-eslint/no-unused-vars */
/* eslint-disable react-hooks/exhaustive-deps */
import { editorInteractionStateAtom } from '@/app/atoms/editorInteractionStateAtom';
import { sheets } from '@/app/grid/controller/Sheets';
import { focusGrid } from '@/app/helpers/focusGrid';
import { Selection } from '@/app/quadratic-core-types';
import { a1StringToSelection, selectionToA1String } from '@/app/quadratic-rust-client/quadratic_rust_client';
import '@/app/ui/styles/floating-dialog.css';
import { GoToIcon } from '@/shared/components/Icons';
import { Command, CommandInput, CommandItem, CommandList } from '@/shared/shadcn/ui/command';
import React, { useCallback, useMemo } from 'react';
import { useSetRecoilState } from 'recoil';

export const GoTo = () => {
  const setEditorInteractionState = useSetRecoilState(editorInteractionStateAtom);

  const [value, setValue] = React.useState<string>('');

  const closeMenu = useCallback(() => {
    setEditorInteractionState((state) => ({
      ...state,
      showGoToMenu: false,
    }));
    focusGrid();
  }, [setEditorInteractionState]);

  const convertedInput = useMemo(() => {
    if (!value) {
      return (
        <span>
          <span className="font-bold">A1</span>
        </span>
      );
    }
    try {
      const selection = a1StringToSelection(value, sheets.sheet.id, sheets.getRustSheetMap());
      if (selection) {
        const a1String = selectionToA1String(selection, sheets.sheet.id, sheets.getRustSheetMap());
        return (
          <span>
            <span className="font-bold">{a1String}</span>
          </span>
        );
      } else {
        return <span>A1</span>;
      }
    } catch (e: any) {
      if (e) {
        try {
          const error = JSON.parse(e);
          if (error?.InvalidSheetName) {
            return (
              <span>
                Sheet <span className="font-bold">{error.InvalidSheetName}</span> not found
              </span>
            );
          } else if (error?.TooManySheets) {
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
      sheets.sheet.cursor.changePosition({
        keyboardMovePosition: { x: 1, y: 1 },
        cursorPosition: { x: 1, y: 1 },
        multiCursor: null,
        columnRow: null,
        ensureVisible: true,
      });
    } else {
      try {
        const selection = a1StringToSelection(value, sheets.sheet.id, sheets.getRustSheetMap());
        const s: Selection = JSON.parse(selection);
        sheets.changeSelection(s);
      } catch (_) {
        // nothing to do if we can't parse the input
      }
    }
    closeMenu();
  }, [closeMenu, value]);

  return (
    <Command shouldFilter={false}>
      <CommandInput
        value={value}
        onValueChange={(value) => {
          setValue(value);
        }}
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
          {convertedInput ? <div>Go to {convertedInput}</div> : null}
          <GoToIcon className="text-muted-foreground" />
        </CommandItem>
        {/* <CommandItem className="flex cursor-pointer items-center justify-between">
          <div>Rename range {convertedInput}</div>
        </CommandItem> */}
      </CommandList>
    </Command>
  );
};
