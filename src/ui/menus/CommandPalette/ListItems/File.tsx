import { CommandPaletteListItemSharedProps } from '../CommandPaletteListItem';
import { CommandPaletteListItem } from '../CommandPaletteListItem';
import { newGridFile } from '../../../../grid/actions/gridFile/OpenGridFile';
import { SaveGridFile } from '../../../../grid/actions/gridFile/SaveGridFile';
import { NoteAddOutlined, UploadFileOutlined } from '@mui/icons-material';
import { SaveFileOutlined } from '../../../icons';
import { KeyboardSymbols } from '../../../../helpers/keyboardSymbols';
import { useRecoilState } from 'recoil';
import { editorInteractionStateAtom } from '../../../../atoms/editorInteractionStateAtom';
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
    label: 'File: Open…',
    Component: (props: CommandPaletteListItemSharedProps) => {
      const [editorInteractionState, setEditorInteractionState] = useRecoilState(editorInteractionStateAtom);
      return (
        <CommandPaletteListItem
          {...props}
          icon={<UploadFileOutlined />}
          shortcut="O"
          shortcutModifiers={[KeyboardSymbols.Command]}
          action={() => {
            setEditorInteractionState({
              ...editorInteractionState,
              showFileMenu: true,
            });
          }}
        />
      );
    },
  },
];

export default ListItems;
