import { isAvailableBecauseCanEditFile } from '@/app/actions';
import { useGlobalSnackbar } from '@/shared/components/GlobalSnackbarProvider';
import { CSV_IMPORT_MESSAGE, PARQUET_IMPORT_MESSAGE } from '@/shared/constants/appConstants';
import { CommandGroup, CommandPaletteListItem, CommandPaletteListItemDynamicProps } from '../CommandPaletteListItem';

const commands: CommandGroup = {
  heading: 'Import',
  commands: [
    {
      label: 'CSV',
      isAvailable: isAvailableBecauseCanEditFile,
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
      label: 'Parquet',
      isAvailable: isAvailableBecauseCanEditFile,
      Component: (props: CommandPaletteListItemDynamicProps) => {
        const { addGlobalSnackbar } = useGlobalSnackbar();
        return (
          <CommandPaletteListItem
            {...props}
            action={() => {
              addGlobalSnackbar(PARQUET_IMPORT_MESSAGE);
            }}
          />
        );
      },
    },
  ],
};

export default commands;
