import { isAvailableBecauseFileLocationIsAccessibleAndWriteable } from '@/app/actions';
import {
  editorInteractionStateShowAddConnectionMenuAtom,
  editorInteractionStateShowCellTypeMenuAtom,
  editorInteractionStateShowConnectionsMenuAtom,
} from '@/app/atoms/editorInteractionStateAtom';
import type {
  CommandGroup,
  CommandPaletteListItemDynamicProps,
} from '@/app/ui/menus/CommandPalette/CommandPaletteListItem';
import { CommandPaletteListItem } from '@/app/ui/menus/CommandPalette/CommandPaletteListItem';
import { AddIcon, DatabaseIcon } from '@/shared/components/Icons';
import { useSetRecoilState } from 'recoil';

const commands: CommandGroup = {
  heading: 'Connections',
  commands: [
    {
      label: 'Use a connection',
      isAvailable: isAvailableBecauseFileLocationIsAccessibleAndWriteable,
      Component: (props: CommandPaletteListItemDynamicProps) => {
        const setShowCellTypeMenu = useSetRecoilState(editorInteractionStateShowCellTypeMenuAtom);

        return <CommandPaletteListItem {...props} action={() => setShowCellTypeMenu(true)} icon={<DatabaseIcon />} />;
      },
    },
    {
      label: 'Add a connection',
      isAvailable: ({ teamPermissions }) => !!teamPermissions && teamPermissions.includes('TEAM_EDIT'),
      Component: (props: CommandPaletteListItemDynamicProps) => {
        const setShowAddConnectionMenu = useSetRecoilState(editorInteractionStateShowAddConnectionMenuAtom);

        return <CommandPaletteListItem {...props} action={() => setShowAddConnectionMenu(true)} icon={<AddIcon />} />;
      },
    },
    {
      label: 'Manage connections',
      isAvailable: ({ teamPermissions }) => !!teamPermissions && teamPermissions.includes('TEAM_EDIT'),
      Component: (props: CommandPaletteListItemDynamicProps) => {
        const setShowConnectionsMenu = useSetRecoilState(editorInteractionStateShowConnectionsMenuAtom);

        return (
          <CommandPaletteListItem {...props} action={() => setShowConnectionsMenu(true)} icon={<DatabaseIcon />} />
        );
      },
    },
  ],
};

export default commands;
