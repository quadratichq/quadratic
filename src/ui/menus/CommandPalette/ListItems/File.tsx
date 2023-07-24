import { CommandPaletteListItemSharedProps } from '../CommandPaletteListItem';
import { CommandPaletteListItem } from '../CommandPaletteListItem';
import { NoteAddOutlined } from '@mui/icons-material';
import { ShareFileOutlined, SaveFileOutlined } from '../../../icons';
import { useRecoilState } from 'recoil';
import { editorInteractionStateAtom } from '../../../../atoms/editorInteractionStateAtom';
// import { useLocalFiles } from '../../../contexts/LocalFiles';
// import apiClientSingleton from '../../../../api-client/apiClientSingleton';

const ListItems = [
  {
    label: 'File: New',
    Component: (props: CommandPaletteListItemSharedProps) => {
      const createNewFile = () => {}; // TODO useLocalFiles();
      return <CommandPaletteListItem {...props} icon={<NoteAddOutlined />} action={createNewFile} />;
    },
  },
  {
    label: 'File: Download local copy',
    Component: (props: CommandPaletteListItemSharedProps) => {
      // const { file } = useLocalFiles();
      const downloadCurrentFile = () => {
        // TODO
        // apiClientSingleton.downloadFile(file.id);
      };
      return <CommandPaletteListItem {...props} icon={<SaveFileOutlined />} action={downloadCurrentFile} />;
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
