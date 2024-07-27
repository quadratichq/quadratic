import { useSetRecoilState } from 'recoil';

import { isAvailableBecauseFileLocationIsAccessibleAndWriteable } from '@/app/actions';
import { editorInteractionStateAtom } from '@/app/atoms/editorInteractionStateAtom';
import { CommandPaletteListItem } from '@/app/ui/menus/CommandPalette/CommandPaletteListItem';
import type {
  CommandGroup,
  CommandPaletteListItemDynamicProps,
} from '@/app/ui/menus/CommandPalette/CommandPaletteListItem';

const commands: CommandGroup = {
  heading: 'Connections',
  commands: [
    {
      label: 'Use a connection',
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
