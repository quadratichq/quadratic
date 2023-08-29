import { UploadFile } from '@mui/icons-material';
import { isEditorOrAbove } from '../../../../actions';
import { useGlobalSnackbar } from '../../../../components/GlobalSnackbarProvider';
import { CSV_IMPORT_MESSAGE } from '../../../../constants/appConstants';
import { CommandPaletteListItem, CommandPaletteListItemSharedProps } from '../CommandPaletteListItem';

const ListItems = [
  {
    label: 'Import: CSV',
    isAvailable: isEditorOrAbove,
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
