import { isAvailableBecauseCanEditFile, isAvailableBecauseFileLocationIsAccessibleAndWriteable } from '@/app/actions';
import { editorInteractionStateAtom } from '@/app/atoms/editorInteractionStateAtom';
import { useGlobalSnackbar } from '@/shared/components/GlobalSnackbarProvider';
import { CSV_IMPORT_MESSAGE, PARQUET_IMPORT_MESSAGE } from '@/shared/constants/appConstants';
import { useSetRecoilState } from 'recoil';
import { CommandGroup, CommandPaletteListItem, CommandPaletteListItemDynamicProps } from '../CommandPaletteListItem';

const commands: CommandGroup = {
  heading: 'Import',
  commands: [
    {
      label: 'From CSV',
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
      label: 'From Parquet',
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
    {
      label: 'From connection',
      isAvailable: isAvailableBecauseFileLocationIsAccessibleAndWriteable,
      Component: (props: CommandPaletteListItemDynamicProps) => {
        const setEditorInteractionState = useSetRecoilState(editorInteractionStateAtom);

        return (
          <CommandPaletteListItem
            {...props}
            action={() => {
              setEditorInteractionState((prev) => ({ ...prev, showCellTypeMenu: true }));
            }}
          />
        );
      },
    },
    {
      label: 'Manage connections',
      isAvailable: isAvailableBecauseFileLocationIsAccessibleAndWriteable,
      Component: (props: CommandPaletteListItemDynamicProps) => {
        const setEditorInteractionState = useSetRecoilState(editorInteractionStateAtom);

        return (
          <CommandPaletteListItem
            {...props}
            action={() => {
              setEditorInteractionState((prev) => ({ ...prev, showConnectionsMenu: true }));
            }}
          />
        );
      },
    },
  ],
};

export default commands;
