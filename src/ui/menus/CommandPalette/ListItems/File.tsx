import { CommandPaletteListItemSharedProps } from '../CommandPaletteListItem';
import { CommandPaletteListItem } from '../CommandPaletteListItem';
import { newGridFile, openGridFile } from '../../../../core/actions/gridFile/OpenGridFile';
import { SaveGridFile } from '../../../../core/actions/gridFile/SaveGridFile';
import { UnarchiveOutlined, NoteAddOutlined, SaveAlt } from '@mui/icons-material';

const ListItems = [
  {
    label: 'File: New',
    Component: (props: CommandPaletteListItemSharedProps) => (
      <CommandPaletteListItem
        {...props}
        icon={<NoteAddOutlined />}
        action={() => {
          newGridFile('Untitled.grid', props.sheetController);
        }}
      />
    ),
  },
  {
    label: 'File: Save local copy',
    Component: (props: CommandPaletteListItemSharedProps) => (
      <CommandPaletteListItem
        {...props}
        icon={<SaveAlt />}
        action={() => {
          SaveGridFile(props.sheetController.sheet, true);
        }}
      />
    ),
  },
  {
    label: 'File: Open local',
    Component: (props: CommandPaletteListItemSharedProps) => (
      <CommandPaletteListItem
        {...props}
        icon={<UnarchiveOutlined />}
        action={() => {
          openGridFile(props.sheetController);
        }}
      />
    ),
  },
];

export default ListItems;
