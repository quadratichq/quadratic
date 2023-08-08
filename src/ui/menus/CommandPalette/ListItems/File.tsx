import { NoteAddOutlined } from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';
import { useRecoilState } from 'recoil';
import { editorInteractionStateAtom } from '../../../../atoms/editorInteractionStateAtom';
import { SaveFileOutlined, ShareFileOutlined } from '../../../icons';
import { CommandPaletteListItem, CommandPaletteListItemSharedProps } from '../CommandPaletteListItem';

const ListItems = [
  {
    label: 'File: New',
    Component: (props: CommandPaletteListItemSharedProps) => {
      const navigate = useNavigate();
      const action = () => navigate('/files/create');
      return <CommandPaletteListItem {...props} icon={<NoteAddOutlined />} action={action} />;
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
