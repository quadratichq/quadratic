import { NoteAddOutlined } from '@mui/icons-material';
import { useNavigate, useParams } from 'react-router-dom';
import { apiClient } from '../../../../api/apiClient';
import { ROUTES } from '../../../../constants/routes';
import { SaveFileOutlined } from '../../../icons';
import { CommandPaletteListItem, CommandPaletteListItemSharedProps } from '../CommandPaletteListItem';

const ListItems = [
  {
    label: 'File: New',
    Component: (props: CommandPaletteListItemSharedProps) => {
      const navigate = useNavigate();
      const action = () => navigate(ROUTES.CREATE_FILE);
      return <CommandPaletteListItem {...props} icon={<NoteAddOutlined />} action={action} />;
    },
  },
  {
    label: 'File: Download local copy',
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
];

export default ListItems;
