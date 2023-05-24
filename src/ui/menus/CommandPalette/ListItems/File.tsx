import { CommandPaletteListItemSharedProps } from '../CommandPaletteListItem';
import { CommandPaletteListItem } from '../CommandPaletteListItem';
import { NoteAddOutlined, UploadFileOutlined } from '@mui/icons-material';
import { ShareFileOutlined, SaveFileOutlined } from '../../../icons';
import { KeyboardSymbols } from '../../../../helpers/keyboardSymbols';
import { useRecoilState } from 'recoil';
import { editorInteractionStateAtom } from '../../../../atoms/editorInteractionStateAtom';
import { useLocalFiles } from '../../../contexts/LocalFiles';

const ListItems = [
  {
    label: 'File: New',
    Component: (props: CommandPaletteListItemSharedProps) => {
      const { createNewFile } = useLocalFiles();
      return <CommandPaletteListItem {...props} icon={<NoteAddOutlined />} action={createNewFile} />;
    },
  },
  {
    label: 'File: Download local copy',
    Component: (props: CommandPaletteListItemSharedProps) => {
      const { downloadCurrentFile } = useLocalFiles();
      return <CommandPaletteListItem {...props} icon={<SaveFileOutlined />} action={() => downloadCurrentFile()} />;
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
  {
    label: 'File: Share…',
    Component: (props: CommandPaletteListItemSharedProps) => {
      const [editorInteractionState, setEditorInteractionState] = useRecoilState(editorInteractionStateAtom);
      return (
        <CommandPaletteListItem
          {...props}
          icon={<ShareFileOutlined />}
          action={() => {
            setEditorInteractionState({
              ...editorInteractionState,
              showShareMenu: true,
            });
          }}
        />
      );
    },
  },
];

export default ListItems;
