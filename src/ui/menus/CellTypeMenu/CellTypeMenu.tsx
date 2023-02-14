import React, { useCallback } from 'react';
import {
  Divider,
  List,
  ListItem,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Dialog,
  Paper,
  InputBase,
  Link,
} from '@mui/material';
import { useRecoilState } from 'recoil';
import { editorInteractionStateAtom } from '../../../atoms/editorInteractionStateAtom';
import { CellTypes } from '../../../grid/sheet/gridTypes';

import '../../styles/floating-dialog.css';
import { focusGrid } from '../../../helpers/focusGrid';
import { Python, Formula, JavaScript, Sql } from '../../icons';
import { colors } from '../../../theme/colors';

export interface CellTypeOption {
  name: string;
  mode: CellTypes;
  icon: any;
  description: string | JSX.Element;
  disabled?: boolean;
}

const CELL_TYPE_OPTIONS = [
  {
    name: 'Formula',
    mode: 'FORMULA',
    icon: <Formula sx={{ color: colors.languageFormula }} />,
    description: (
      <>
        Use classic spreadsheet logic including math (
        {['*', '+', '-', '/'].map((s) => (
          <>
            <code>{s}</code>{' '}
          </>
        ))}
        ) and formulas like <code>SUM</code>, <code>IF</code>, and <code>AVERAGE</code>.{' '}
        <LinkNewTab href="https://docs.quadratichq.com/">Learn more</LinkNewTab>.
      </>
    ),
  },
  {
    name: 'Python',
    mode: 'PYTHON',
    icon: <Python sx={{ color: colors.languagePython }} />,
    description: (
      <>
        Script, fetch, and compute with your data. Includes the power of Pandas, NumPy, and SciPy.{' '}
        <LinkNewTab href="https://docs.quadratichq.com/reference/python-cell-reference">Learn more</LinkNewTab>.
      </>
    ),
  },
  {
    name: 'SQL Query',
    mode: 'SQL',
    icon: <Sql color="disabled" />,
    description: 'Coming soon: import data with queries.',
    disabled: true,
  },
  {
    name: 'JavaScript',
    mode: 'JAVASCRIPT',
    icon: <JavaScript color="disabled" />,
    description: 'Coming soon: the world’s most used programming language.',
    disabled: true,
  },
] as CellTypeOption[];

export default function CellTypeMenu() {
  const [editorInteractionState, setEditorInteractionState] = useRecoilState(editorInteractionStateAtom);
  const [value, setValue] = React.useState<string>('');
  const [selectedIndex, setSelectedIndex] = React.useState<number>(0);
  const searchlabel = 'Choose a cell type…';
  const options = CELL_TYPE_OPTIONS.filter((option) => option.name.toLowerCase().includes(value));

  const close = useCallback(() => {
    setEditorInteractionState({
      ...editorInteractionState,
      showCellTypeMenu: false,
    });
    focusGrid();
  }, [editorInteractionState, setEditorInteractionState]);

  const openEditor = useCallback(
    (mode: CellTypes) => {
      setEditorInteractionState({
        ...editorInteractionState,
        ...{
          showCodeEditor: true,
          showCellTypeMenu: false,
          mode,
        },
      });
    },
    [editorInteractionState, setEditorInteractionState]
  );

  return (
    <Dialog open={true} onClose={close} fullWidth maxWidth={'xs'} BackdropProps={{ invisible: true }}>
      <Paper
        id="CellTypeMenuID"
        component="form"
        elevation={12}
        onKeyUp={(e: React.KeyboardEvent) => {
          // Don't bother if there's nothing to key up/down through
          if (options.length <= 1) {
            return;
          }

          if (e.key === 'ArrowDown') {
            e.preventDefault();
            e.stopPropagation();
            let newIndex = selectedIndex;
            while (newIndex === selectedIndex || options[newIndex]?.disabled) {
              newIndex = newIndex < options.length - 1 ? newIndex + 1 : 0;
            }
            setSelectedIndex(newIndex);
          } else if (e.key === 'ArrowUp') {
            e.preventDefault();
            e.stopPropagation();
            let newIndex = selectedIndex;
            while (newIndex === selectedIndex || options[newIndex]?.disabled) {
              newIndex = newIndex === 0 ? options.length - 1 : newIndex - 1;
            }
            setSelectedIndex(newIndex);
          }
        }}
        onSubmit={(e: React.FormEvent) => {
          e.preventDefault();
          if (!options[selectedIndex]?.disabled) {
            openEditor(options[selectedIndex].mode);
          }
        }}
      >
        <InputBase
          id="CellTypeMenuInputID"
          sx={{ width: '100%', padding: '8px 16px' }}
          placeholder={searchlabel}
          inputProps={{ 'aria-label': searchlabel }}
          autoFocus
          autoComplete="off"
          value={value}
          onChange={(event: React.ChangeEvent<HTMLInputElement>) => {
            setSelectedIndex(0);
            setValue(event.target.value);
          }}
        />

        <Divider />

        <List dense={true} disablePadding>
          {options.length ? (
            options.map(({ name, disabled, description, mode, icon }, i) => (
              <ListItemButton
                key={i}
                disabled={disabled}
                onClick={() => {
                  openEditor(mode);
                }}
                selected={selectedIndex === i && !disabled}
              >
                <ListItemIcon>{icon}</ListItemIcon>
                <ListItemText primary={name} secondary={description} />
              </ListItemButton>
            ))
          ) : (
            <ListItem disablePadding>
              <ListItemButton disabled>
                <ListItemText primary="No matches" />
              </ListItemButton>
            </ListItem>
          )}
        </List>
      </Paper>
    </Dialog>
  );
}

function LinkNewTab({ href, children }: { href: string; children: string }) {
  return (
    <Link
      href={href}
      onClick={(e) => {
        e.stopPropagation();
      }}
      target="_blank"
      rel="noopener"
    >
      {children}
    </Link>
  );
}
