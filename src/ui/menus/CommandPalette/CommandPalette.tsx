import React, { useEffect } from 'react';
import {
  Divider,
  IconButton,
  InputBase,
  List,
  ListItem,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  ListItemSecondaryAction,
  Paper,
} from '@mui/material';
import { Search } from '@mui/icons-material';

import { useRecoilState } from 'recoil';
import { editorInteractionStateAtom } from '../../../atoms/editorInteractionStateAtom';

import './styles.css';
import { focusGrid } from '../../../helpers/focusGrid';

import { commands, QuadraticCommand } from './commands';

export const CommandPalette = () => {
  const [editorInteractionState, setEditorInteractionState] = useRecoilState(editorInteractionStateAtom);
  const { showCommandPalette } = editorInteractionState;

  const [value, setValue] = React.useState<string>('');
  const [selectedIndex, setSelectedIndex] = React.useState<number>(0);
  const filteredList: Array<QuadraticCommand> = commands.filter((command) => {
    return value ? command.name.toLowerCase().includes(value) : true;
  });

  const close = () => {
    setEditorInteractionState({
      ...editorInteractionState,
      showCellTypeMenu: false,
      showCommandPalette: false,
    });
    setValue('');
    setSelectedIndex(0);
    focusGrid();
  };

  // Upon keyboard navigation, scroll the element into view
  useEffect(() => {
    const el = document.querySelector(`[data-command-bar-list-item-index='${selectedIndex}']`);
    if (el) {
      // @TODO refine this for keying up through the list
      el.scrollIntoView({
        behavior: 'smooth',
        block: 'nearest',
      });
    }
  }, [selectedIndex]);

  // Cleanup to initial state when component is closed
  useEffect(() => {
    return () => {
      setValue('');
      setSelectedIndex(0);
    };
  }, [showCommandPalette]);

  if (!showCommandPalette) {
    return null;
  }

  const searchlabel = 'Search menus and commands…';

  return (
    <Paper elevation={12} className="container" style={{ width: 450 }}>
      <div style={{ padding: '2px 4px', display: 'flex', alignItems: 'center' }}>
        <IconButton type="button" sx={{ p: '10px' }} aria-label="search">
          <Search />
        </IconButton>

        <InputBase
          sx={{ flex: 1 }}
          placeholder={searchlabel}
          inputProps={{ 'aria-label': searchlabel }}
          autoFocus
          value={value}
          onKeyUp={(e) => {
            if (e.key === 'Escape') {
              close();
            } else if (e.key === 'Enter') {
              // Do thing....
              console.log('Fire action: ', filteredList[selectedIndex].name);
              close();
              // @TODO VScode supports alt+n/p for going up down, should we?
            } else if (e.key === 'ArrowDown') {
              e.preventDefault();
              e.stopPropagation();
              setSelectedIndex(selectedIndex === filteredList.length - 1 ? 0 : selectedIndex + 1);
            } else if (e.key === 'ArrowUp') {
              e.preventDefault();
              e.stopPropagation();
              setSelectedIndex(selectedIndex === 0 ? filteredList.length - 1 : selectedIndex - 1);
            }
          }}
          onChange={(event: React.ChangeEvent<HTMLInputElement>) => {
            setSelectedIndex(0);
            setValue(event.target.value);
          }}
        />
      </div>
      <Divider />
      <div style={{ height: '300px', overflow: 'scroll' }}>
        <List dense={true}>
          {filteredList.length ? (
            filteredList.map((e: any, i: number) => {
              // Highlight the matching text in the results (if there's a current value)
              let displayText = e.name;
              if (value) {
                const index = displayText.toLowerCase().indexOf(value);
                const displayTextHighlight = displayText.slice(index, index + value.length);
                displayText = (
                  <span
                    dangerouslySetInnerHTML={{
                      __html: displayText.replace(displayTextHighlight, `<b>${displayTextHighlight}</b>`),
                    }}
                  />
                );
              }

              return (
                <ListItem disablePadding key={e.name}>
                  <ListItemButton
                    data-command-bar-list-item-index={i}
                    selected={selectedIndex === i}
                    disabled={e.disabled}
                    onClick={() => {
                      console.log('Fire action: ', e.name);
                      close();
                    }}
                  >
                    {e.icon ? (
                      <>
                        <ListItemIcon>{e.icon}</ListItemIcon>
                        <ListItemText primary={displayText} />
                      </>
                    ) : (
                      <ListItemText primary={displayText} inset={!e.icon} />
                    )}
                    {e.shortcut && (
                      <ListItemSecondaryAction style={{ fontSize: '14px', opacity: '.5' }}>
                        {convertModifierKeyToSymbol(e.shortcutModifiers) + e.shortcut}
                      </ListItemSecondaryAction>
                    )}
                  </ListItemButton>
                </ListItem>
              );
            })
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
  );
};

// @TODO windows and make it work with other keyboard file
// Maybe consider something like https://github.com/ueberdosis/keyboard-symbol#readme
// Should generalize this for use in other menus
function convertModifierKeyToSymbol(modifiers: Array<string>) {
  let out = '';

  if (modifiers && modifiers.length > 0) {
    modifiers.forEach((modifier) => {
      // @TODO if is windows/mac
      if (modifier === 'ctrl') {
        out = '⌘';
      } else if (modifier === 'alt') {
        out = '⌥';
      } else if (modifier === 'shift') {
        out = '⇧';
      }
    });
  }

  return out;
}
