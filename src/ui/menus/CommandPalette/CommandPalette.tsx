import { Dialog, Divider, InputBase, List, ListItem, ListItemButton, ListItemText, Paper } from '@mui/material';
import mixpanel from 'mixpanel-browser';
import React, { useEffect } from 'react';
import { useRecoilState } from 'recoil';
import inputRef from 'utils/inputRef';
import { editorInteractionStateAtom } from '../../../atoms/editorInteractionStateAtom';
import { gridInteractionStateAtom } from '../../../atoms/gridInteractionStateAtom';
import { SheetController } from '../../../grid/controller/sheetController';
import { PixiApp } from '../../../gridGL/pixiApp/PixiApp';
import { focusGrid } from '../../../helpers/focusGrid';
import '../../styles/floating-dialog.css';
import { getCommandPaletteListItems } from './getCommandPaletteListItems';

interface Props {
  app: PixiApp;
  sheetController: SheetController;
}

export const CommandPalette = (props: Props) => {
  const [interactionState] = useRecoilState(gridInteractionStateAtom);
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const [editorInteractionState, setEditorInteractionState] = useRecoilState(editorInteractionStateAtom);
  const [activeSearchValue, setActiveSearchValue] = React.useState<string>('');
  const [selectedListItemIndex, setSelectedListItemIndex] = React.useState<number>(0);

  // Fn that closes the command palette and gets passed down to individual ListItems
  const closeCommandPalette = () => {
    setEditorInteractionState((state) => ({
      ...state,
      showCellTypeMenu: false,
      showCommandPalette: false,
    }));
    focusGrid();
  };

  useEffect(() => {
    mixpanel.track('[CommandPalette].open');
  }, []);

  // Upon keyboard navigation, scroll the element into view
  useEffect(() => {
    const el = document.querySelector(`[data-command-bar-list-item-index='${selectedListItemIndex}']`);
    if (el) {
      el.scrollIntoView({
        block: 'nearest',
      });
    }
  }, [selectedListItemIndex]);

  // Otherwise, define vars and render the lsit
  const ListItems = getCommandPaletteListItems({
    sheetController: props.sheetController,
    app: props.app,
    interactionState,
    closeCommandPalette,
    activeSearchValue: activeSearchValue,
    selectedListItemIndex: selectedListItemIndex,
  });

  const searchlabel = 'Search menus and commands…';

  return (
    <Dialog open={true} onClose={closeCommandPalette} fullWidth maxWidth={'xs'} BackdropProps={{ invisible: true }}>
      <Paper
        component="form"
        elevation={12}
        onKeyUp={(e: React.KeyboardEvent) => {
          if (e.key === 'ArrowDown') {
            e.preventDefault();
            e.stopPropagation();
            setSelectedListItemIndex(selectedListItemIndex === ListItems.length - 1 ? 0 : selectedListItemIndex + 1);
          } else if (e.key === 'ArrowUp') {
            e.preventDefault();
            e.stopPropagation();
            setSelectedListItemIndex(selectedListItemIndex === 0 ? ListItems.length - 1 : selectedListItemIndex - 1);
          }
        }}
        onSubmit={(e: React.FormEvent) => {
          e.preventDefault();
          const el = document.querySelector(`[data-command-bar-list-item-index='${selectedListItemIndex}']`);
          if (el !== undefined) {
            (el as HTMLElement).click();
          }
        }}
      >
        <InputBase
          sx={{ width: '100%', padding: '8px 16px' }}
          placeholder={searchlabel}
          inputProps={{ 'aria-label': searchlabel }}
          inputRef={inputRef}
          value={activeSearchValue}
          onChange={(event: React.ChangeEvent<HTMLInputElement>) => {
            setSelectedListItemIndex(0);
            setActiveSearchValue(event.target.value);
          }}
        />

        <Divider />
        <div style={{ maxHeight: '330px', overflowY: 'scroll', paddingBottom: '5px' }}>
          <List dense={true} disablePadding>
            {ListItems.length ? (
              ListItems
            ) : (
              <ListItem disablePadding>
                <ListItemButton disabled>
                  <ListItemText primary="No matches" />
                </ListItemButton>
              </ListItem>
            )}
          </List>
        </div>
      </Paper>
    </Dialog>
  );
};
