import { CommandPaletteListItemSharedProps } from '../CommandPaletteListItem';
import { CommandPaletteListItem } from '../CommandPaletteListItem';
import { UploadFileOutlined } from '@mui/icons-material';
import { SaveFileOutlined } from '../../../icons';
import { KeyboardSymbols } from '../../../../helpers/keyboardSymbols';
import { useRecoilState } from 'recoil';
import { editorInteractionStateAtom } from '../../../../atoms/editorInteractionStateAtom';
import { useLocalFiles } from '../../../../storage/useLocalFiles';

const ListItems = [
  // {
  //   label: 'File: New',
  //   Component: (props: CommandPaletteListItemSharedProps) => {
  //     const { newFile } = useLocalFiles(props.sheetController);
  //     <CommandPaletteListItem
  //       {...props}
  //       icon={<NoteAddOutlined />}
  //       action={newFile}
  //     />
  //   },
  // },
  {
    label: 'File: Save local copy',
    Component: (props: CommandPaletteListItemSharedProps) => {
      const { save } = useLocalFiles(props.sheetController);
      return (
        <CommandPaletteListItem
          {...props}
          icon={<SaveFileOutlined />}
          action={save}
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
