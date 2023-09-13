import { East } from '@mui/icons-material';
import { Dialog, Divider, InputBase, List, ListItem, ListItemButton, ListItemText, Paper } from '@mui/material';
import React, { SyntheticEvent } from 'react';
import { useRecoilState } from 'recoil';
import { editorInteractionStateAtom } from '../../../atoms/editorInteractionStateAtom';
import { gridInteractionStateAtom } from '../../../atoms/gridInteractionStateAtom';
import { SheetController } from '../../../grid/controller/sheetController';
import { isVisible, moveViewport } from '../../../gridGL/interaction/viewportHelper';
import { PixiApp } from '../../../gridGL/pixiApp/PixiApp';
import { Coordinate } from '../../../gridGL/types/size';
import { focusGrid } from '../../../helpers/focusGrid';
import focusInput from '../../../utils/focusInput';
import '../../styles/floating-dialog.css';
import { getCoordinatesFromUserInput } from './getCoordinatesFromUserInput';

interface Props {
  app: PixiApp;
  sheetController: SheetController;
}

export const GoTo = (props: Props) => {
  const [interactionState, setInteractionState] = useRecoilState(gridInteractionStateAtom);
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

  const onSelect = (e: React.FormEvent | SyntheticEvent) => {
    e.preventDefault();
    const [coor1, coor2] = coordinates;

    // GoTo Cell
    let newInteractionState = {
      ...interactionState,
      cursorPosition: coor1,
      keyboardMovePosition: coor1,
      multiCursorPosition: {
        originPosition: coor1,
        terminalPosition: coor1,
      },
      showMultiCursor: false,
    };

    // GoTo range
    if (coor2) {
      // User has given us two arbitrary points. We need to figure out the
      // upper left to bottom right coordinates of a rectangle between those coordinates
      const originPosition: Coordinate = { x: Math.min(coor1.x, coor2.x), y: Math.min(coor1.y, coor2.y) };
      const terminalPosition: Coordinate = { x: Math.max(coor1.x, coor2.x), y: Math.max(coor1.y, coor2.y) };

      newInteractionState = {
        ...newInteractionState,
        keyboardMovePosition: originPosition,
        cursorPosition: originPosition,
        multiCursorPosition: {
          originPosition,
          terminalPosition,
        },
        showMultiCursor: true,
      };
    }

    setInteractionState(newInteractionState);
    if (coor1.x === 0 && coor1.y === 0 && !coor2)
      moveViewport({
        app: props.app,
        topLeft: newInteractionState.cursorPosition,
      });
    else if (
      !isVisible({
        app: props.app,
        interactionState: newInteractionState,
        sheet: props.sheetController.sheet,
      })
    )
      moveViewport({
        app: props.app,
        center: newInteractionState.cursorPosition,
      });

    closeMenu();
    focusGrid();
  };

  return (
    <Dialog open={showGoToMenu} onClose={closeMenu} fullWidth maxWidth={'xs'}>
      <Paper component="form" elevation={12} onSubmit={onSelect}>
        <InputBase
          sx={{ width: '100%', padding: '8px 16px' }}
          inputRef={focusInput}
          value={value}
          fullWidth
          placeholder="Enter a cell “0, 0” or range “0, 0, -5, -5”"
          onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
            setValue(e.target.value);
          }}
        />

        <Divider />

        <List dense={true} disablePadding>
          <ListItem disablePadding secondaryAction={<East fontSize="small" color="disabled" />}>
            <ListItemButton selected onClick={onSelect}>
              <ListItemText
                primary={`Go to ${coordinates.length === 1 ? 'cell' : 'range'}: ${coordinates
                  .map(({ x, y }) => `(${x}, ${y})`)
                  .join(', ')}`}
              />
            </ListItemButton>
          </ListItem>
        </List>
      </Paper>
    </Dialog>
  );
};
