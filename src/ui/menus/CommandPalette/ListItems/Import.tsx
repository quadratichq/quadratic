import { CommandPaletteListItemSharedProps } from '../CommandPaletteListItem';
import { CommandPaletteListItem } from '../CommandPaletteListItem';
import { UploadFile } from '@mui/icons-material';
import { CSV_IMPORT_MESSAGE } from '../../../../constants/app';
import { useGlobalSnackbar } from '../../../contexts/GlobalSnackbar';

const ListItems = [
  {
    label: 'Import: CSV',
    Component: (props: CommandPaletteListItemSharedProps) => {
      const { addGlobalSnackbar } = useGlobalSnackbar();

      return (
        <CommandPaletteListItem
          {...props}
          icon={<UploadFile />}
          action={() => {
            addGlobalSnackbar(CSV_IMPORT_MESSAGE);
          }}
        />
      );
    },
  },
];

export default ListItems;
