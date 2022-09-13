import React from 'react';
import {
  Divider,
  List,
  ListItem,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Typography,
  Card,
  CardContent,
} from '@mui/material';
import TextField from '@mui/material/TextField';
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
  // {
  //   key: 0,
  //   name: 'Text',
  //   short: 'Aa',
  //   slug: 'TEXT',
  //   description: 'Input any text or numerical data.',
  //   disabled: true,
  // },
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
  {
    key: 30,
    name: 'JavaScript',
    short: 'Js',
    slug: 'JAVASCRIPT',
    description: 'Write JavaScript to quickly compute with data.',
    disabled: true,
  },
  {
    key: 40,
    name: 'SQL Query',
    short: 'DB',
    slug: 'SQL',
    description: 'Query your data using SQL.',
    disabled: true,
  },
] as QuadraticCommand[];

export const CommandPalette = () => {
  // Interaction State hook
  const [editorInteractionState, setEditorInteractionState] = useRecoilState(
    editorInteractionStateAtom
  );

  const [value, setValue] = React.useState<string>('');
  const [selected_value, setSelectedValue] = React.useState<
    CellTypes | undefined
  >('PYTHON');
  const [filtered_cell_type_list, setFilteredCellTypeList] =
    React.useState<any>(QUADRATIC_COMMANDS);

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
    <Card id="CellTypeMenuID" elevation={1} className="container">
      <CardContent>
        <TextField
          id="CommandPaletteInputID"
          value={value}
          onChange={(event: React.ChangeEvent<HTMLInputElement>) => {
            update_filter(event.target.value);
          }}
          onKeyUp={(event) => {
            if (event.key === 'Escape') {
              close();
            }
            if (event.key === 'Enter') {
              openEditor();
            }
          }}
          fullWidth
          variant="standard"
          label="Search menus and commands"
          autoFocus
        />
        <List dense={true} style={{ height: 350, width: 300 }}>
          <ListItem></ListItem>
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
      </CardContent>
    </Card>
  );
};
