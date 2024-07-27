import { ArrowForward } from '@mui/icons-material';
import { Rectangle } from 'pixi.js';
import React from 'react';
import { useRecoilState } from 'recoil';

import { editorInteractionStateAtom } from '@/app/atoms/editorInteractionStateAtom';
import { sheets } from '@/app/grid/controller/Sheets';
import { moveViewport } from '@/app/gridGL/interaction/viewportHelper';
import type { Coordinate } from '@/app/gridGL/types/size';
import { getCoordinatesFromUserInput } from '@/app/ui/menus/GoTo/getCoordinatesFromUserInput';
import '@/app/ui/styles/floating-dialog.css';
import { CommandDialog, CommandInput, CommandItem, CommandList } from '@/shared/shadcn/ui/command';

export const GoTo = () => {
  const [editorInteractionState, setEditorInteractionState] = useRecoilState(editorInteractionStateAtom);
  const { showGoToMenu } = editorInteractionState;
  const [value, setValue] = React.useState<string>('');

  const closeMenu = () => {
    setEditorInteractionState((state) => ({
      ...state,
      showGoToMenu: false,
    }));
  };

  const coordinates = getCoordinatesFromUserInput(value);

  const onSelect = () => {
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
  };

  return (
    <CommandDialog dialogProps={{ open: showGoToMenu, onOpenChange: closeMenu }} commandProps={{ shouldFilter: false }}>
      <CommandInput
        value={value}
        onValueChange={(value) => {
          setValue(value);
        }}
        placeholder="Enter a cell “0, 0” or range “0, 0, -5, -5”"
        omitIcon={true}
      />
      <CommandList className="p-2">
        <CommandItem onSelect={onSelect} className="flex items-center justify-between">
          Go to {coordinates.length === 1 ? 'cell' : 'range'}:{' '}
          {coordinates.map(({ x, y }) => `(${x}, ${y})`).join(', ')}
          <ArrowForward className="text-muted-foreground" />
        </CommandItem>
      </CommandList>
    </CommandDialog>
  );
};
