import React, { SyntheticEvent, useEffect } from 'react';
import { Dialog, Divider, InputBase, List, ListItem, ListItemButton, ListItemText, Paper } from '@mui/material';
import { useRecoilState } from 'recoil';
import { editorInteractionStateAtom } from '../../../atoms/editorInteractionStateAtom';
import { gridInteractionStateAtom } from '../../../atoms/gridInteractionStateAtom';
import { focusGrid } from '../../../helpers/focusGrid';
import { PixiApp } from '../../../core/gridGL/pixiApp/PixiApp';
import { SheetController } from '../../../core/transaction/sheetController';
import { East } from '@mui/icons-material';
import { getCoordinatesFromUserInput } from './getCoordinatesFromUserInput';
import { Coordinate } from '../../../core/gridGL/types/size';
import { moveViewport } from '../../../core/gridGL/interaction/viewportHelper';
import './styles.css';

interface Props {
  app: PixiApp;
  sheetController: SheetController;
}

export const GoTo = (props: Props) => {
  const [interactionState, setInteractionState] = useRecoilState(gridInteractionStateAtom);
  const [editorInteractionState, setEditorInteractionState] = useRecoilState(editorInteractionStateAtom);
  const { showGoToMenu } = editorInteractionState;
  const [value, setValue] = React.useState<string>('');

  // Cleanup to initial state when component is closed
  useEffect(() => {
    return () => {
      setValue('');
    };
  }, [showGoToMenu]);

  // Hide the menu when applicable
  if (!showGoToMenu) {
    return null;
  }

  const closeMenu = () => {
    setEditorInteractionState((state) => ({
      ...state,
      showGoToMenu: false,
    }));
    setValue('');
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
    moveViewport({
      app: props.app,
      topLeft: newInteractionState.cursorPosition,
    });
    closeMenu();
    focusGrid();
  };

  return (
    <Dialog open={showGoToMenu} onClose={closeMenu} fullWidth maxWidth={'xs'} BackdropProps={{ invisible: true }}>
      <Paper component="form" elevation={12} onSubmit={onSelect}>
        <InputBase
          sx={{ flex: 1, display: 'flex', p: '8px 16px' }}
          autoFocus
          value={value}
          fullWidth
          onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
            setValue(e.target.value);
          }}
        />

        <Divider />

        <List dense={true} disablePadding>
          <ListItem disablePadding secondaryAction={<East fontSize="small" color="disabled" />}>
            <ListItemButton selected onSelect={onSelect}>
              <ListItemText
                primary={`Go to ${coordinates.length === 1 ? 'cell' : 'range'}: ${coordinates
                  .map(({ x, y }) => `(${x}, ${y})`)
                  .join(', ')}`}
              />
            </ListItemButton>
          </ListItem>

          <Divider />
          <ListItem disabled>
            <ListItemText primary="Specify a cell “0, 0” or a range “0, 0, -5, -5”" />
          </ListItem>
        </List>
      </Paper>
    </Dialog>
  );
};
