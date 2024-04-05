import { useSearchParams } from 'react-router-dom';
import { hasPermissionToEditFile } from '../../../../actions';
import { useGlobalSnackbar } from '../../../../components/GlobalSnackbarProvider';
import { CSV_IMPORT_MESSAGE } from '../../../../constants/appConstants';
import { CommandGroup, CommandPaletteListItem, CommandPaletteListItemDynamicProps } from '../CommandPaletteListItem';

const commands: CommandGroup = {
  heading: 'Data',
  commands: [
    {
      label: 'Import CSV',
      isAvailable: hasPermissionToEditFile,
      Component: (props: CommandPaletteListItemDynamicProps) => {
        const { addGlobalSnackbar } = useGlobalSnackbar();
        return (
          <CommandPaletteListItem
            {...props}
            action={() => {
              addGlobalSnackbar(CSV_IMPORT_MESSAGE);
            }}
          />
        );
      },
    },
    {
      label: 'Manage connections',
      isAvailable: hasPermissionToEditFile, // TODO: what's right here?
      Component: (props: CommandPaletteListItemDynamicProps) => {
        const [, setSearchParams] = useSearchParams();

        return (
          <CommandPaletteListItem
            {...props}
            action={() => {
              setSearchParams((prev) => {
                prev.set('connections', 'list');
                return prev;
              });
            }}
          />
        );
      },
    },
  ],
};

export default commands;
