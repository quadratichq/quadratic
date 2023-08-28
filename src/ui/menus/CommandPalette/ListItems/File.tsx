import { DeleteOutline, NoteAddOutlined } from '@mui/icons-material';
import { useNavigate, useParams } from 'react-router-dom';
import { createNewFile, duplicateFile } from '../../../../actions';
import { apiClient } from '../../../../api/apiClient';
import { ROUTES } from '../../../../constants/routes';
import { SaveFileOutlined } from '../../../icons';
import { CommandPaletteListItem, CommandPaletteListItemSharedProps } from '../CommandPaletteListItem';

const ListItems = [
  {
    label: 'File: ' + createNewFile.label,
    isAvailable: createNewFile.isAvailable,
    Component: (props: CommandPaletteListItemSharedProps) => {
      const navigate = useNavigate();
      const action = () => createNewFile.run({ navigate });
      return <CommandPaletteListItem {...props} icon={<NoteAddOutlined />} action={action} />;
    },
  },
  {
    label: 'File: ' + duplicateFile.label,
    isAvailable: duplicateFile.isAvailable,
    Component: (props: CommandPaletteListItemSharedProps) => {
      const navigate = useNavigate();
      const action = () => navigate(ROUTES.CREATE_FILE);
      return <CommandPaletteListItem {...props} icon={<NoteAddOutlined />} action={action} />;
    },
  },
  {
    label: 'File: Download local copy',
    // permissions: ['OWNER', 'EDITOR', 'VIEWER'],
    Component: (props: CommandPaletteListItemSharedProps) => {
      const { uuid } = useParams();
      const downloadCurrentFile = () => {
        if (uuid) {
          apiClient.downloadFile(uuid);
        }
      };
      return <CommandPaletteListItem {...props} icon={<SaveFileOutlined />} action={downloadCurrentFile} />;
    },
  },
  {
    label: 'File: Delete',
    // permissions: ['OWNER'],
    Component: (props: CommandPaletteListItemSharedProps) => {
      // TODO
      // const navigate = useNavigate();
      const action = () => {};
      return <CommandPaletteListItem {...props} icon={<DeleteOutline />} action={action} />;
    },
  },
];

export default ListItems;
