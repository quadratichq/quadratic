import React, { useEffect } from 'react';
import { Dialog, Divider, InputBase, List, ListItem, ListItemButton, ListItemText, Paper } from '@mui/material';
import { useRecoilState } from 'recoil';
import { editorInteractionStateAtom } from '../../../atoms/editorInteractionStateAtom';
import { gridInteractionStateAtom } from '../../../atoms/gridInteractionStateAtom';
import { focusGrid } from '../../../helpers/focusGrid';
import { PixiApp } from '../../../core/gridGL/pixiApp/PixiApp';
import { SheetController } from '../../../core/transaction/sheetController';
import { East } from '@mui/icons-material';

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

  const coordinates = getCoordinatesFromInput(value);

  const onSelect = (e: any) => {
    e.preventDefault();
    const [[x, y], range] = coordinates;

    setInteractionState({
      ...interactionState,
      ...(range
        ? {
            cursorPosition: { x, y },
            multiCursorPosition: {
              originPosition: { x, y },
              terminalPosition: { x: range[0], y: range[1] },
            },
            showMultiCursor: true,
          }
        : {
            cursorPosition: { x, y },
          }),
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
                  .map(([x, y]) => `(${x}, ${y})`)
                  .join(' – ')}`}
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

/**a
 * Takes user input and returns an array of coordinates, with the second set of
 * coordinates being optional.
 * Defaults to (0, 0): e.g. `[[0,0]]`
 * Supports a 2nd set of coordinates when input is valid: e.g. `[[0,0], [2,3]]
 *
 * TODO write unit tests for this
 */
function getCoordinatesFromInput(str: string): number[][] {
  let out = [[0, 0]];

  const matches = str.match(/-?\d+/g);

  // 0 matches
  if (!matches) {
    return out;
  }

  // 1 or 2 matches
  const [x1, y1, x2, y2] = matches.map((str) => Number(str));
  out[0][0] = x1;
  if (y1) {
    out[0][1] = y1;
  }

  // 3 or 4 matches
  if (Number.isInteger(x2)) {
    out.push([x2, y2 === undefined ? y1 + 1 : y2]);
  }

  // Return match(es)
  return out;
}
