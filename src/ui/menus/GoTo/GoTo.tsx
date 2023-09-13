import { East } from '@mui/icons-material';
import { Dialog, Divider, InputBase, List, ListItem, ListItemButton, ListItemText, Paper } from '@mui/material';
import React, { SyntheticEvent } from 'react';
import { useRecoilState } from 'recoil';
import { editorInteractionStateAtom } from '../../../atoms/editorInteractionStateAtom';
import { sheets } from '../../../grid/controller/Sheets';
import { Coordinate } from '../../../gridGL/types/size';
import { focusGrid } from '../../../helpers/focusGrid';
import focusInput from '../../../utils/focusInput';
import '../../styles/floating-dialog.css';
import { getCoordinatesFromUserInput } from './getCoordinatesFromUserInput';

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

  const onSelect = (e: React.FormEvent | SyntheticEvent) => {
    e.preventDefault();
    const [coor1, coor2] = coordinates;

    // GoTo Cell
    let cursorPosition = coor1;
    let keyboardMovePosition = coor1;
    let multiCursor: undefined | { originPosition: Coordinate; terminalPosition: Coordinate };

    // GoTo range
    if (coor2) {
      // User has given us two arbitrary points. We need to figure out the
      // upper left to bottom right coordinates of a rectangle between those coordinates
      const originPosition: Coordinate = { x: Math.min(coor1.x, coor2.x), y: Math.min(coor1.y, coor2.y) };
      const terminalPosition: Coordinate = { x: Math.max(coor1.x, coor2.x), y: Math.max(coor1.y, coor2.y) };

      keyboardMovePosition = originPosition;
      cursorPosition = originPosition;
      multiCursor = {
        originPosition,
        terminalPosition,
      };
    }
    sheets.sheet.cursor.changePosition({
      keyboardMovePosition,
      cursorPosition,
      multiCursor,
    });
    closeMenu();
    focusGrid();
  };

  return (
    <Dialog open={showGoToMenu} onClose={closeMenu} fullWidth maxWidth={'xs'} BackdropProps={{ invisible: true }}>
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
