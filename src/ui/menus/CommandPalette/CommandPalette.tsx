import React, { useCallback, useEffect } from 'react';
import {
  Checkbox,
  Dialog,
  Modal,
  Divider,
  IconButton,
  InputBase,
  List,
  ListItem,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  ListItemSecondaryAction,
  Typography,
  Paper,
} from '@mui/material';
import {
  Search,
  BorderAll,
  BorderOuter,
  BorderTop,
  BorderRight,
  BorderLeft,
  BorderBottom,
  BorderInner,
  BorderHorizontal,
  BorderVertical,
  FormatBold,
  FormatItalic,
  FormatColorText,
  FormatAlignCenter,
  FormatAlignLeft,
  FormatAlignRight,
  BorderClear,
} from '@mui/icons-material';

import { useRecoilState } from 'recoil';
import { editorInteractionStateAtom } from '../../../atoms/editorInteractionStateAtom';
import { CellTypes } from '../../../core/gridDB/gridTypes';

import './styles.css';
import { focusGrid } from '../../../helpers/focusGrid';

export interface QuadraticCommand {
  name: string;
  action?: any; // @TODO action to run when selected
  icon?: any;
  disabled?: boolean | undefined | string;
  comingSoon?: boolean | undefined;
  shortcut?: string;
  shortcutModifiers?: Array<'ctrl' | 'shift' | 'alt'>;
}

const QUADRATIC_COMMANDS = [
  {
    name: 'Undo',
    shortcut: 'Z',
    shortcutModifiers: ['ctrl'],
  },
  {
    name: 'Redo',
    shortcut: 'Z',
    shortcutModifiers: ['ctrl', 'shift'],
  },
  {
    name: 'Borders: Apply borders to all',
    icon: BorderAll,
  },
  {
    name: 'Borders: Apply outer borders',
    icon: BorderOuter,
  },
  {
    name: 'Borders: Apply inner borders',
    icon: BorderInner,
  },
  {
    name: 'Borders: Apply vertical borders',
    icon: BorderVertical,
  },
  {
    name: 'Borders: Apply horizontal borders',
    icon: BorderHorizontal,
  },
  {
    name: 'Borders: Apply left border',
    icon: BorderLeft,
  },
  {
    name: 'Borders: Apply right border',
    icon: BorderRight,
  },
  {
    name: 'Borders: Apply top border',
    icon: BorderTop,
  },
  {
    name: 'Borders: Apply bottom border',
    icon: BorderBottom,
  },
  {
    name: 'Borders: Clear all',
    icon: BorderClear,
  },
  {
    name: 'View: Show row and column headings',
    icon: (props: any) => (
      <Checkbox
        edge="start"
        checked={props.checked}
        tabIndex={-1}
        disableRipple
        inputProps={{ 'aria-labelledby': '@TODO' }}
        {...props}
      />
    ),
  },
  {
    name: 'View: Show axis',
    icon: (props: any) => (
      <Checkbox
        edge="start"
        checked={props.checked}
        tabIndex={-1}
        disableRipple
        inputProps={{ 'aria-labelledby': '@TODO' }}
        {...props}
      />
    ),
  },
  {
    name: 'Import: CSV',
    comingSoon: true,
  },
  {
    name: 'Import: Excel',
    comingSoon: true,
  },
  {
    name: 'Text: Toggle bold',
    icon: FormatBold,
    comingSoon: true,
  },
  {
    name: 'Text: Toggle italic',
    icon: FormatItalic,
    comingSoon: true,
  },
  {
    name: 'Text: Change color',
    icon: FormatColorText,
    comingSoon: true,
  },
  {
    name: 'Text: Wrap text',
    comingSoon: true,
  },
  {
    name: 'Text: Wrap text overflow',
    comingSoon: true,
  },
  {
    name: 'Text: Wrap text',
    comingSoon: true,
  },
  {
    name: 'Text: Align left',
    icon: FormatAlignLeft,
    comingSoon: true,
  },
  {
    name: 'Text: Align center',
    icon: FormatAlignCenter,
    comingSoon: true,
  },
  {
    name: 'Text: Align right',
    icon: FormatAlignRight,
    comingSoon: true,
  },
] as QuadraticCommand[];

export const CommandPalette = () => {
  // Interaction State hook
  const [editorInteractionState, setEditorInteractionState] = useRecoilState(editorInteractionStateAtom);

  const [isHidden, setIsHidden] = React.useState<boolean>(false);
  const [value, setValue] = React.useState<string>('');
  const [selectedIndex, setSelectedIndex] = React.useState<number>(0);
  const filteredList = QUADRATIC_COMMANDS.filter((item) => {
    return value ? item.name.toLowerCase().includes(value) : true;
  });

  const close = () => {
    setEditorInteractionState({
      ...editorInteractionState,
      showCellTypeMenu: false,
    });
    setValue('');
    // update_filter('');
    focusGrid();
    // setIsHidden(true);
  };

  // Scroll navigated elements into view
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

  // const onKeyDown = useCallback(
  //   (e: KeyboardEvent) => {
  //     console.log(e);
  //     if ((e.metaKey || e.ctrlKey) && e.code === 'KeyP') {
  //       e.preventDefault();
  //       e.stopPropagation();
  //       setIsHidden(!isHidden);
  //     }
  //   },
  //   [isHidden]
  // );
  // useEffect(() => {
  //   document.addEventListener('keydown', onKeyDown);
  //   return () => window.removeEventListener('keydown', onKeyDown);
  // }, [isHidden, onKeyDown]);

  if (isHidden) {
    return null;
  }

  return (
    <Paper id="CellTypeMenuID" elevation={12} className="container" style={{ width: 450 }}>
      <div>
        <IconButton type="button" sx={{ p: '10px' }} aria-label="search">
          <Search />
        </IconButton>

        <InputBase
          sx={{ ml: 1, flex: 1 }}
          placeholder="Search…"
          inputProps={{ 'aria-label': 'Search menus and commands…' }}
          autoFocus
          value={value}
          onKeyUp={(e) => {
            if (e.key === 'Escape') {
              close();
            } else if (e.key === 'Enter') {
              // Do thing....
              // @TODO VScode supports n/p for going up down, should we?
            } else if (e.key === 'ArrowDown') {
              e.preventDefault();
              e.stopPropagation();
              setSelectedIndex(selectedIndex === filteredList.length - 1 ? 0 : selectedIndex + 1);
            } else if (e.key === 'ArrowUp') {
              e.preventDefault();
              e.stopPropagation();
              setSelectedIndex(selectedIndex === 0 ? filteredList.length - 1 : selectedIndex - 1);
              // handleChangeSelected('up');
            }
          }}
          onChange={(event: React.ChangeEvent<HTMLInputElement>) => {
            setValue(event.target.value);
          }}
        />
      </div>
      <List dense={true} style={{ height: '350px', overflow: 'scroll' }}>
        {filteredList.map((e: any, i: number) => {
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
            <ListItemButton
              key={i}
              data-command-bar-list-item-index={i}
              selected={selectedIndex === i}
              disabled={Boolean(e.disabled) || e.comingSoon}
              style={{ width: '100%' }}
              onClick={() => {
                console.log('Fire off action');
                close();
              }}
            >
              {e.icon && <ListItemIcon>{React.createElement(e.icon)}</ListItemIcon>}
              <ListItemText primary={displayText} inset={!e.icon} />
              {e.comingSoon && (
                <ListItemSecondaryAction style={{ fontSize: '13px' }}>Coming soon…</ListItemSecondaryAction>
              )}
              {e.shortcut && (
                <ListItemSecondaryAction>
                  {convertModifierKeyToSymbol(e.shortcutModifiers) + e.shortcut}
                </ListItemSecondaryAction>
              )}
            </ListItemButton>
          );
        })}
      </List>
    </Paper>
  );
};

// @TODO windows and make it work with other keyboard file
// Maybe consider something like https://github.com/ueberdosis/keyboard-symbol#readme
function convertModifierKeyToSymbol(modifiers: Array<string>) {
  let out = '';

  if (modifiers && modifiers.length > 0) {
    modifiers.forEach((modifier) => {
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
