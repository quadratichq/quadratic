import React, { useEffect } from 'react';
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

  // Hide the CommandPalette when applicable
  if (!showGoToMenu) {
    return null;
  }

  const closeMenu = () => {
    setEditorInteractionState({
      ...editorInteractionState,
      showGoToMenu: false,
    });
    setValue('');
  };

  const coordinates = getCoordinatesFromUserInput(value);

  const onSelect = (e: any) => {
    e.preventDefault();
    const [coors1, coors2] = coordinates;

    if (coors2) {
      // GoTo range
      // User has given us two arbitrary points. We need to figure out the
      // upper left to bottom right coordinates of a rectangle between those coordinates
      const originPosition: Coordinate = { x: Math.min(coors1.x, coors2.x), y: Math.min(coors1.y, coors2.y) };
      const terminalPosition: Coordinate = { x: Math.max(coors1.x, coors2.x), y: Math.max(coors1.y, coors2.y) };

      setInteractionState({
        ...interactionState,
        cursorPosition: originPosition,
        multiCursorPosition: {
          originPosition,
          terminalPosition,
        },
        showMultiCursor: true,
      });
    } else {
      // GoTo Cell
      setInteractionState({
        ...interactionState,
        cursorPosition: coors1,
        multiCursorPosition: {
          originPosition: coors1,
          terminalPosition: coors1,
        },
        showMultiCursor: false,
      });
    }

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
