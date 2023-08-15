import {
  Chip,
  Dialog,
  Divider,
  InputBase,
  List,
  ListItem,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Paper,
} from '@mui/material';
import mixpanel from 'mixpanel-browser';
import React, { useCallback, useEffect } from 'react';
import { useRouteLoaderData } from 'react-router-dom';
import { useRecoilState } from 'recoil';
import { editorInteractionStateAtom } from '../../../atoms/editorInteractionStateAtom';
import { DOCUMENTATION_FORMULAS_URL, DOCUMENTATION_PYTHON_URL } from '../../../constants/urls';
import { focusGrid } from '../../../helpers/focusGrid';
import { RootLoaderData } from '../../../router';
import { CellType } from '../../../schemas';
import { colors } from '../../../theme/colors';
import focusInput from '../../../utils/focusInput';
import { LinkNewTab } from '../../components/LinkNewTab';
import { AI, Formula, JavaScript, Python, Sql } from '../../icons';
import '../../styles/floating-dialog.css';

export interface CellTypeOption {
  name: string;
  mode: CellType;
  icon: any;
  description: string | JSX.Element;
  disabled?: boolean;
  experimental?: boolean;
}

let CELL_TYPE_OPTIONS = [
  {
    name: 'Formula',
    mode: 'FORMULA',
    icon: <Formula sx={{ color: colors.languageFormula }} />,
    description: (
      <>
        Classic spreadsheet logic like <code>SUM</code>, <code>AVERAGE</code>,{' '}
        <LinkNewTabWrapper href={DOCUMENTATION_FORMULAS_URL}>and more</LinkNewTabWrapper>.
      </>
    ),
  },
  {
    name: 'Python',
    mode: 'PYTHON',
    icon: <Python sx={{ color: colors.languagePython }} />,
    description: (
      <>
        Script with Pandas, NumPy, SciPy, Micropip,{' '}
        <LinkNewTabWrapper href={DOCUMENTATION_PYTHON_URL}>and more</LinkNewTabWrapper>.
      </>
    ),
  },
  {
    name: 'Artificial Intelligence (AI)',
    mode: 'AI',
    icon: <AI sx={{ color: colors.languageAI }} />,
    description: <>Generate data using an AI prompt. </>,
    experimental: true,
  },
  {
    name: 'SQL Query',
    mode: 'SQL',
    icon: <Sql color="disabled" />,
    description: 'Import your data with queries.',
    disabled: true,
  },
  {
    name: 'JavaScript',
    mode: 'JAVASCRIPT',
    icon: <JavaScript color="disabled" />,
    description: 'The world’s most popular programming language.',
    disabled: true,
  },
] as CellTypeOption[];

export default function CellTypeMenu() {
  const [editorInteractionState, setEditorInteractionState] = useRecoilState(editorInteractionStateAtom);
  const [value, setValue] = React.useState<string>('');
  const [selectedIndex, setSelectedIndex] = React.useState<number>(0);
  const { isAuthenticated } = useRouteLoaderData('root') as RootLoaderData;
  const searchlabel = 'Choose a cell type…';

  if (!isAuthenticated) {
    // remove the AI option if not authenticated
    CELL_TYPE_OPTIONS = CELL_TYPE_OPTIONS.filter((option) => option.mode !== 'AI');
  }

  const options = CELL_TYPE_OPTIONS.filter((option) => option.name.toLowerCase().includes(value.toLowerCase()));

  useEffect(() => {
    mixpanel.track('[CellTypeMenu].opened');
  }, []);

  const close = useCallback(() => {
    setEditorInteractionState({
      ...editorInteractionState,
      showCellTypeMenu: false,
    });
    focusGrid();
  }, [editorInteractionState, setEditorInteractionState]);

  const openEditor = useCallback(
    (mode: CellType) => {
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
          inputRef={focusInput}
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
            options.map(({ name, disabled, description, mode, icon, experimental }, i) => (
              <ListItemButton
                key={i}
                disabled={disabled}
                onClick={() => {
                  openEditor(mode);
                }}
                selected={selectedIndex === i && !disabled}
              >
                <ListItemIcon>{icon}</ListItemIcon>
                <ListItemText
                  primary={
                    <>
                      {name} {disabled && <Chip label="Coming soon" size="small" />}{' '}
                      {experimental && <Chip label="Experimental" size="small" color="warning" variant="outlined" />}
                    </>
                  }
                  secondary={description}
                />
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

function LinkNewTabWrapper(props: any) {
  return (
    <LinkNewTab
      {...props}
      onClick={(e: React.SyntheticEvent) => {
        e.stopPropagation();
      }}
    />
  );
}
