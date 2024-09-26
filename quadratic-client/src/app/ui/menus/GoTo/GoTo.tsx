import { editorInteractionStateAtom } from '@/app/atoms/editorInteractionStateAtom';
import { sheets } from '@/app/grid/controller/Sheets';
import { moveViewport } from '@/app/gridGL/interaction/viewportHelper';
import { Coordinate } from '@/app/gridGL/types/size';
import '@/app/ui/styles/floating-dialog.css';
import { GoToIcon } from '@/shared/components/Icons';
import { Command, CommandInput, CommandItem, CommandList } from '@/shared/shadcn/ui/command';
import { Rectangle } from 'pixi.js';
import React, { useCallback } from 'react';
import { useSetRecoilState } from 'recoil';
import { getCoordinatesFromUserInput } from './getCoordinatesFromUserInput';

export const GoTo = () => {
  const setEditorInteractionState = useSetRecoilState(editorInteractionStateAtom);

  const [value, setValue] = React.useState<string>('');

  const closeMenu = useCallback(() => {
    setEditorInteractionState((state) => ({
      ...state,
      showGoToMenu: false,
    }));
  }, [setEditorInteractionState]);

  const coordinates = getCoordinatesFromUserInput(value);

  const onSelect = useCallback(() => {
    const [coor1, coor2] = coordinates;

    // GoTo Cell
    let cursorPosition = coor1;
    let keyboardMovePosition = coor1;
    let multiCursor: undefined | Rectangle[];

    // GoTo range
    if (coor2) {
      // User has given us two arbitrary points. We need to figure out the
      // upper left to bottom right coordinates of a rectangle between those coordinates
      const originPosition: Coordinate = { x: Math.min(coor1.x, coor2.x), y: Math.min(coor1.y, coor2.y) };
      const terminalPosition: Coordinate = { x: Math.max(coor1.x, coor2.x), y: Math.max(coor1.y, coor2.y) };

      keyboardMovePosition = originPosition;
      cursorPosition = originPosition;
      multiCursor = [
        new Rectangle(
          originPosition.x,
          originPosition.y,
          terminalPosition.x - originPosition.x + 1,
          terminalPosition.y - originPosition.y + 1
        ),
      ];
    }
    sheets.sheet.cursor.changePosition({
      keyboardMovePosition,
      cursorPosition,
      multiCursor,
    });
    moveViewport({ topLeft: cursorPosition });
    closeMenu();
  }, [closeMenu, coordinates]);

  return (
    <Command shouldFilter={false}>
      <CommandInput
        value={value}
        onValueChange={(value) => {
          setValue(value);
        }}
        placeholder="Enter a cell “0, 0” or range “0, 0, -5, -5”"
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
          Go to {coordinates.length === 1 ? 'cell' : 'range'}:{' '}
          {coordinates.map(({ x, y }) => `(${x}, ${y})`).join(', ')}
          <GoToIcon className="text-muted-foreground" />
        </CommandItem>
      </CommandList>
    </Command>
  );
};
