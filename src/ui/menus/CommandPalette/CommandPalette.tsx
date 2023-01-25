import React, { useEffect } from 'react';
import {
  Dialog,
  Divider,
  IconButton,
  InputBase,
  List,
  ListItem,
  ListItemButton,
  ListItemText,
  Paper,
} from '@mui/material';
import { Search } from '@mui/icons-material';
import { useRecoilState } from 'recoil';
import { editorInteractionStateAtom } from '../../../atoms/editorInteractionStateAtom';
import { gridInteractionStateAtom } from '../../../atoms/gridInteractionStateAtom';
import { focusGrid } from '../../../helpers/focusGrid';
import { PixiApp } from '../../../core/gridGL/pixiApp/PixiApp';
import { SheetController } from '../../../core/transaction/sheetController';
import { getCommandPaletteListItems } from './getCommandPaletteListItems';

interface Props {
  app: PixiApp;
  sheetController: SheetController;
}

export const CommandPalette = (props: Props) => {
  const [interactionState] = useRecoilState(gridInteractionStateAtom);
  const [editorInteractionState, setEditorInteractionState] = useRecoilState(editorInteractionStateAtom);
  const { showCommandPalette } = editorInteractionState;

  const [activeSearchValue, setActiveSearchValue] = React.useState<string>('');
  const [selectedListItemIndex, setSelectedListItemIndex] = React.useState<number>(0);

  // Fn that closes the command palette and gets passed down to individual ListItems
  const closeCommandPalette = () => {
    setEditorInteractionState({
      ...editorInteractionState,
      showCellTypeMenu: false,
      showCommandPalette: false,
    });
    setActiveSearchValue('');
    setSelectedListItemIndex(0);
    focusGrid();
  };

  // Upon keyboard navigation, scroll the element into view
  useEffect(() => {
    const el = document.querySelector(`[data-command-bar-list-item-index='${selectedListItemIndex}']`);
    if (el) {
      el.scrollIntoView({
        behavior: 'smooth',
        block: 'nearest',
      });
    }
  }, [selectedListItemIndex]);

  // Cleanup to initial state when component is closed
  useEffect(() => {
    return () => {
      setActiveSearchValue('');
      setSelectedListItemIndex(0);
    };
  }, [showCommandPalette]);

  // Hide the CommandPalette when applicable
  if (!showCommandPalette) {
    return null;
  }

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
        className="containerz"
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
        <div style={{ padding: '4px 8px', display: 'flex', alignItems: 'center' }}>
          <IconButton type="button" sx={{ p: '8px', mr: '8px' }} aria-label="search">
            <Search />
          </IconButton>

          <InputBase
            sx={{ flex: 1 }}
            placeholder={searchlabel}
            inputProps={{ 'aria-label': searchlabel }}
            autoFocus
            value={activeSearchValue}
            onChange={(event: React.ChangeEvent<HTMLInputElement>) => {
              setSelectedListItemIndex(0);
              setActiveSearchValue(event.target.value);
            }}
          />
        </div>
        <Divider />
        <div style={{ height: '240px', overflow: 'scroll' }}>
          <List dense={true} disablePadding>
            {ListItems.length ? (
              ListItems
            ) : (
              <ListItem disablePadding>
                <ListItemButton disabled>
                  <ListItemText inset primary="No matches" />
                </ListItemButton>
              </ListItem>
            )}
          </List>
        </div>
      </Paper>
    </Dialog>
  );
};
