import React from 'react';
import {
  Divider,
  IconButton,
  InputBase,
  List,
  ListItem,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Typography,
  Paper,
} from '@mui/material';
import SearchIcon from '@mui/icons-material/Search';

import { useRecoilState } from 'recoil';
import { editorInteractionStateAtom } from '../../../atoms/editorInteractionStateAtom';
import { CellTypes } from '../../../core/gridDB/db';

import './styles.css';
import { focusGrid } from '../../../helpers/focusGrid';

export interface QuadraticCommand {
  key: number;
  name: string;
  short: string;
  slug: CellTypes;
  description: string;
  disabled: boolean;
}

const QUADRATIC_COMMANDS = [
  {
    key: 0,
    name: 'Show Grid Lines',
    short: 'Py',
    slug: 'PYTHON',
    description: '',
    disabled: false,
  },
  {
    key: 20,
    name: 'Show Grid Header',
    short: '=',
    slug: 'FORMULA',
    description: 'Familiar Excel-like formulas.',
    disabled: true,
  },
] as QuadraticCommand[];

export const CommandPalette = () => {
  // Interaction State hook
  const [editorInteractionState, setEditorInteractionState] = useRecoilState(editorInteractionStateAtom);

  const [value, setValue] = React.useState<string>('');
  const [selected_value, setSelectedValue] = React.useState<CellTypes | undefined>('PYTHON');
  const [filtered_cell_type_list, setFilteredCellTypeList] = React.useState<any>(QUADRATIC_COMMANDS);

  const update_filter = (value: string) => {
    const filtered_cell_type_list = QUADRATIC_COMMANDS.filter((cell_type) => {
      return cell_type.slug.includes(value.toUpperCase());
    });

    const selected_value = filtered_cell_type_list[0]?.slug;

    setSelectedValue(selected_value);
    setFilteredCellTypeList(filtered_cell_type_list);
    setValue(value);
  };

  const close = () => {
    setEditorInteractionState({
      ...editorInteractionState,
      showCellTypeMenu: false,
    });
    setValue('');
    update_filter('');
    focusGrid();
  };

  const openEditor = (mode = null) => {
    setEditorInteractionState({
      ...editorInteractionState,
      ...{
        showCodeEditor: true,
        showCellTypeMenu: false,
        mode: mode || selected_value || 'PYTHON',
      },
    });
  };

  return (
    <Paper id="CellTypeMenuID" elevation={12} className="container">
      <div>
        <IconButton type="button" sx={{ p: '10px' }} aria-label="search">
          <SearchIcon />
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
              openEditor();
              // @TODO VScode supports n/p for going up down, should we?
            } else if (e.key === 'ArrowDown' || (e.ctrlKey && e.key === 'n')) {
              e.preventDefault();
              e.stopPropagation();
              // handleChangeSelected('down');
            } else if (e.key === 'ArrowUp' || (e.ctrlKey && e.key === 'p')) {
              e.preventDefault();
              e.stopPropagation();
              // handleChangeSelected('up');
            }
          }}
        />
        {/* <TextField
        id="CommandPaletteInputID"
        onChange={(event: React.ChangeEvent<HTMLInputElement>) => {
          update_filter(event.target.value);
        }}
        
        
      /> */}
      </div>
      <List dense={true} style={{ height: 350, width: 300 }}>
        <Divider variant="fullWidth" />
        {filtered_cell_type_list.map((e: any) => {
          return (
            <ListItemButton
              key={e.key}
              selected={selected_value === e.slug}
              disabled={e.disabled}
              style={{ width: '100%' }}
              onClick={() => {
                openEditor(e.slug);
              }}
            >
              <ListItemIcon>
                <Typography>{e.short}</Typography>
              </ListItemIcon>
              <ListItemText primary={e.name} secondary={e.description} />
            </ListItemButton>
          );
        })}
      </List>
    </Paper>
  );
};
