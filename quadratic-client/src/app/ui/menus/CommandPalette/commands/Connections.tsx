import { isAvailableBecauseFileLocationIsAccessibleAndWriteable } from '@/app/actions';
import {
  editorInteractionStateShowAddConnectionMenuAtom,
  editorInteractionStateShowCellTypeMenuAtom,
} from '@/app/atoms/editorInteractionStateAtom';
import type {
  CommandGroup,
  CommandPaletteListItemDynamicProps,
} from '@/app/ui/menus/CommandPalette/CommandPaletteListItem';
import { CommandPaletteListItem } from '@/app/ui/menus/CommandPalette/CommandPaletteListItem';
import { AddIcon, DatabaseIcon } from '@/shared/components/Icons';
import { useSetRecoilState } from 'recoil';

// TODO: change these to be 1 of 4 things:
// 1. Query a connection
// 2. Prompt a connection
// 3. Manage connections (if there are some)
// 4. Add a connection
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
        // const setShowConnectionsMenu = useSetRecoilState(editorInteractionStateShowConnectionsMenuAtom);

        return <CommandPaletteListItem {...props} action={() => {}} icon={<DatabaseIcon />} />;
      },
    },
  ],
};

export default commands;
