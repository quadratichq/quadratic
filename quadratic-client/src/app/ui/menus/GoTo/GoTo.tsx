/* eslint-disable @typescript-eslint/no-unused-vars */
/* eslint-disable react-hooks/exhaustive-deps */
import { editorInteractionStateAtom } from '@/app/atoms/editorInteractionStateAtom';
import { sheets } from '@/app/grid/controller/Sheets';
import { moveViewport } from '@/app/gridGL/interaction/viewportHelper';
import { Coordinate } from '@/app/gridGL/types/size';
import { Selection } from '@/app/quadratic-core-types';
import {
  a1StringToSelection,
  selectionToA1,
  selectionToA1String,
} from '@/app/quadratic-rust-client/quadratic_rust_client';
import '@/app/ui/styles/floating-dialog.css';
import { rectToRectangle } from '@/app/web-workers/quadraticCore/worker/rustConversions';
import { GoToIcon } from '@/shared/components/Icons';
import { Command, CommandInput, CommandItem, CommandList } from '@/shared/shadcn/ui/command';
import { Rectangle } from 'pixi.js';
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
  }, [setEditorInteractionState]);

  const convertedInput = useMemo(() => {
    if (!value) {
      return (
        <span>
          Go to <span className="font-bold">A1</span>
        </span>
      );
    }
    try {
      const selection = a1StringToSelection(value, sheets.sheet.id, sheets.getRustSheetMap());
      const selectionObject: Selection = JSON.parse(selection);
      let sheetName = <></>;
      if (selectionObject.sheet_id.id !== sheets.sheet.id) {
        const name = sheets.getById(selectionObject.sheet_id.id)?.name;
        sheetName = (
          <span>
            <span className="font-bold">{name}</span> at{' '}
          </span>
        );
      }

      if (selection) {
        const a1String = selectionToA1String(selection);
        return (
          <span>
            Go to {sheetName}
            <span className="font-bold">{a1String}</span>
          </span>
        );
      } else {
        return <span>Go to A1</span>;
      }
    } catch (e: any) {
      if (e) {
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
        placeholder="Enter a cell “A1” or selection"
        omitIcon={true}
      />
      <CommandList className="p-2">
        <CommandItem
          onSelect={onSelect}
          className="flex items-center justify-between"
          onPointerDown={(e) => {
            e.preventDefault();
            e.stopPropagation();
          }}
        >
          {convertedInput}
          <GoToIcon className="text-muted-foreground" />
        </CommandItem>
      </CommandList>
    </Command>
  );
};
