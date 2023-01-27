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
  // const { showCommandPalette } = editorInteractionState;
  // `(${interactionState.cursorPosition.x}, ${interactionState.cursorPosition.y})`
  const [value, setValue] = React.useState<string>('');

  // Fn that closes the command palette and gets passed down to individual ListItems
  // const closeCommandPalette = () => {
  //   setEditorInteractionState({
  //     ...editorInteractionState,
  //     showCellTypeMenu: false,
  //     showCommandPalette: false,
  //   });
  //   setActiveSearchValue('');
  //   setSelectedListItemIndex(0);
  //   focusGrid();
  // };

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

  let coordinates = [[interactionState.cursorPosition.x, interactionState.cursorPosition.y]];
  if (value) {
    coordinates = getCoordinatesFromInput(value);
  }

  const onSelect = (e: any) => {
    e.preventDefault();
    console.log(coordinates);
    const [[x, y], coor2] = coordinates;

    setInteractionState({
      ...interactionState,
      ...(coor2
        ? {
            cursorPosition: { x, y },
            multiCursorPosition: {
              originPosition: { x, y },
              terminalPosition: { x: coor2[0], y: coor2[1] },
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
          onKeyPress={(e: any) => {
            if (e.key === 'Enter') {
              return;
            }
            // Don't allow sequential delimeters, e.g. `,` and `:`
            if ((e.key === ',' || e.key === ':') && (value.endsWith(',') || value.endsWith(':'))) {
              e.preventDefault();
            }
            // Don't allow the first character to be a delimeter
            if (value.length === 0 && (e.key === ',' || e.key === ':')) {
              e.preventDefault();
            }
            // Only allow input for denoting cell ranges, e.g. `0-9`, `,` and `:`
            if (/[^,:\d]/.test(e.key)) {
              e.preventDefault();
            }
          }}
          onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
            setValue(e.target.value);
            return;
          }}
        />

        <Divider />

        <List dense={true} disablePadding>
          <ListItem disablePadding secondaryAction={<East fontSize="small" color="disabled" />}>
            <ListItemButton selected onSelect={onSelect}>
              <ListItemText
                primary={
                  value
                    ? `Go to ${coordinates.length === 1 ? 'cell' : 'range'}: ${coordinates
                        .map((r) => `(${r})`)
                        .join(' – ')}`
                    : `Go to current cell: (${interactionState.cursorPosition.x}, ${interactionState.cursorPosition.y})`
                }
              />
            </ListItemButton>
          </ListItem>

          <Divider />
          <ListItem disabled>
            <ListItemText primary="Specify a cell — 0,0 — or a range — 0,0:5,5" />
          </ListItem>
        </List>
      </Paper>
    </Dialog>
  );
};

/**
 * Takes the input (which, thanks to the keyPress event, should be guaranteed
 * to be of a specific format) and returns a set of coordinates.
 * Minimum: 1 set of x/y coordinates, e.g. [[0,1]]
 * Maximum: 2 sets of x/y coordinates, e.g. [[0,1], [1,5]]
 *
 * TODO write unit tests for this
 */
function getCoordinatesFromInput(str: string): [[number, number]] | [[number, number], [number, number]] {
  let out = [];

  const [range1, range2] = str.split(':');
  let [x1, y1] = range1.split(',');
  if (x1) {
    out.push([Number(x1), y1 === undefined ? 0 : Number(y1)]);
  }

  if (range2 !== undefined) {
    let [x2, y2] = range2.split(',');

    const [[x1, y1]] = out;
    if (x2 === '') {
      out.push([x1 + 1, y1 + 1]);
    } else {
      out.push([Number(x2), y2 ? Number(y2) : y1 + 1]);
    }
  }

  // @ts-expect-error
  return out;
}
