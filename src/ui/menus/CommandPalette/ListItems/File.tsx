import { CommandPaletteListItemSharedProps } from '../CommandPaletteListItem';
import { CommandPaletteListItem } from '../CommandPaletteListItem';
import { newGridFile, openGridFile } from '../../../../grid/actions/gridFile/OpenGridFile';
import { SaveGridFile } from '../../../../grid/actions/gridFile/SaveGridFile';
import { NoteAddOutlined, UploadFileOutlined } from '@mui/icons-material';
import { SaveFileOutlined } from '../../../icons';
import { useLocalFiles } from '../../../../hooks/useLocalFiles';

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
    Component: (props: CommandPaletteListItemSharedProps) => {
      const { localFilename } = useLocalFiles();
      return (
        <CommandPaletteListItem
          {...props}
          icon={<SaveFileOutlined />}
          action={() => {
            SaveGridFile(props.sheetController.sheet, true, localFilename);
          }}
        />
      );
    },
  },
  {
    label: 'File: Open local',
    Component: (props: CommandPaletteListItemSharedProps) => (
      <CommandPaletteListItem
        {...props}
        icon={<UploadFileOutlined />}
        action={() => {
          openGridFile(props.sheetController);
        }}
      />
    ),
  },
];

export default ListItems;
