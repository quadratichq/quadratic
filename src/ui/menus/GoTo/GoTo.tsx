import React, { useEffect } from 'react';
import { Dialog, Divider, InputBase, List, ListItem, ListItemButton, ListItemText, Paper } from '@mui/material';
import { useRecoilState } from 'recoil';
import { editorInteractionStateAtom } from '../../../atoms/editorInteractionStateAtom';
import { gridInteractionStateAtom } from '../../../atoms/gridInteractionStateAtom';
import { focusGrid } from '../../../helpers/focusGrid';
import { PixiApp } from '../../../core/gridGL/pixiApp/PixiApp';
import { SheetController } from '../../../core/transaction/sheetController';

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
  const result = value.split(':');

  return (
    <Dialog open={showGoToMenu} onClose={closeMenu} fullWidth maxWidth={'xs'} BackdropProps={{ invisible: true }}>
      <Paper
        component="form"
        elevation={12}
        onSubmit={(e: React.FormEvent) => {
          e.preventDefault();
          console.log(interactionState);
          setInteractionState({
            ...interactionState,
            cursorPosition: { x: 100, y: 20 },
          });
          closeMenu();
        }}
      >
        <InputBase
          sx={{ flex: 1, display: 'flex', p: '8px 16px' }}
          placeholder={''}
          autoFocus
          value={value}
          fullWidth
          onKeyPress={(e: any) => {
            if (e.key === 'Enter') {
              return;
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
          {value ? (
            <ListItem disablePadding>
              <ListItemButton selected>
                <ListItemText
                  primary={`Go to ${result.length === 1 ? 'cell' : 'range'}: ${result
                    .map((r) => `(${r})`)
                    .join(' – ')}`}
                />
              </ListItemButton>
            </ListItem>
          ) : (
            <ListItem disablePadding>
              <ListItemButton selected>
                <ListItemText
                  primary={`Go to current cell: (${interactionState.cursorPosition.x}, ${interactionState.cursorPosition.y})`}
                />
              </ListItemButton>
            </ListItem>
          )}
          <ListItem disablePadding>
            <ListItemButton disabled>
              <ListItemText primary="Specify a cell — 0,0 — or a range — 0,0:5,5" />
            </ListItemButton>
          </ListItem>
        </List>
      </Paper>
    </Dialog>
  );
};
