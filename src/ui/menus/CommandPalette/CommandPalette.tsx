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
import fuzzysort from 'fuzzysort';
import { editorInteractionStateAtom } from '../../../atoms/editorInteractionStateAtom';
import './styles.css';
import { focusGrid } from '../../../helpers/focusGrid';
import { commands, IQuadraticCommand } from './commands';

export const CommandPalette = () => {
  const [editorInteractionState, setEditorInteractionState] = useRecoilState(editorInteractionStateAtom);
  const { showCommandPalette } = editorInteractionState;

  const [value, setValue] = React.useState<string>('');
  const [selectedIndex, setSelectedIndex] = React.useState<number>(0);

  // If needed, this could be optimized by turning commands into an object and
  // doing a lookup of commands by their names
  const results: Fuzzysort.KeyResults<IQuadraticCommand> = fuzzysort.go(value, commands, { key: 'name', all: true });

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
    <Paper
      component="form"
      elevation={12}
      className="container"
      style={{ width: 450 }}
      onKeyUp={(e: React.KeyboardEvent) => {
        if (e.key === 'Escape') {
          close();
        } else if (e.key === 'ArrowDown') {
          e.preventDefault();
          e.stopPropagation();
          setSelectedIndex(selectedIndex === results.length - 1 ? 0 : selectedIndex + 1);
        } else if (e.key === 'ArrowUp') {
          e.preventDefault();
          e.stopPropagation();
          setSelectedIndex(selectedIndex === 0 ? results.length - 1 : selectedIndex - 1);
        }
      }}
      onSubmit={(e: React.FormEvent) => {
        e.preventDefault();

        if (results[selectedIndex].obj.disabled) {
          return;
        }

        console.log('Fire action: ', results[selectedIndex].obj.name);
        close();
      }}
    >
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
          onChange={(event: React.ChangeEvent<HTMLInputElement>) => {
            setSelectedIndex(0);
            setValue(event.target.value);
          }}
        />
      </div>
      <Divider />
      <div style={{ height: '300px', overflow: 'scroll' }}>
        <List dense={true} disablePadding>
          {results.length ? (
            results.map((result: Fuzzysort.KeyResult<IQuadraticCommand>, i: number) => {
              const {
                obj: { disabled, icon, name, shortcut, shortcutModifiers },
              } = result;

              // If there's no active search value, don't try running
              // `fuzzysort.highlight` as it will crash. Not sure if this is
              // a bug, but when we pass the `{ all: true }` option and get
              // all results by default, we can't run the highlight
              const displayText = value ? fuzzysort.highlight(result, (m, i) => <b key={i}>{m}</b>) : name;

              return (
                <ListItem disablePadding key={name} data-command-bar-list-item-index={i}>
                  <ListItemButton
                    selected={selectedIndex === i}
                    disabled={disabled}
                    onClick={() => {
                      console.log('Fire action: ', name);
                      close();
                    }}
                  >
                    {icon ? (
                      <>
                        <ListItemIcon>{icon}</ListItemIcon>
                        <ListItemText primary={displayText} />
                      </>
                    ) : (
                      <ListItemText primary={displayText} inset={!icon} />
                    )}
                    {shortcut && (
                      <ListItemSecondaryAction style={{ fontSize: '14px', opacity: '.5' }}>
                        {shortcutModifiers ? shortcutModifiers : ''}
                        {shortcut}
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
