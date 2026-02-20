import { isAvailableBecauseFileLocationIsAccessibleAndWriteable } from '@/app/actions';
import { connectionPickerModeAtom } from '@/app/atoms/connectionPickerAtom';
import { editorInteractionStateShowAddConnectionMenuAtom } from '@/app/atoms/editorInteractionStateAtom';
import type {
  CommandGroup,
  CommandPaletteListItemDynamicProps,
} from '@/app/ui/menus/CommandPalette/CommandPaletteListItem';
import { CommandPaletteListItem } from '@/app/ui/menus/CommandPalette/CommandPaletteListItem';
import { AddIcon, CodeIcon, DatabaseIcon, PromptIcon } from '@/shared/components/Icons';
import { useSetRecoilState } from 'recoil';

const commands: CommandGroup = {
  heading: 'Connections',
  commands: [
    {
      label: 'Query a connection',
      keywords: ['connection', 'database', 'sql', 'query'],
      isAvailable: isAvailableBecauseFileLocationIsAccessibleAndWriteable,
      Component: (props: CommandPaletteListItemDynamicProps) => {
        const setConnectionPickerMode = useSetRecoilState(connectionPickerModeAtom);
        return (
          <CommandPaletteListItem
            {...props}
            action={() => setConnectionPickerMode('query')}
            icon={<CodeIcon />}
            shortcut="/"
          />
        );
      },
    },
    {
      label: 'Prompt a connection',
      keywords: ['connection', 'ai', 'analyst', 'prompt', 'chat'],
      isAvailable: isAvailableBecauseFileLocationIsAccessibleAndWriteable,
      Component: (props: CommandPaletteListItemDynamicProps) => {
        const setConnectionPickerMode = useSetRecoilState(connectionPickerModeAtom);
        return (
          <CommandPaletteListItem {...props} action={() => setConnectionPickerMode('prompt')} icon={<PromptIcon />} />
        );
      },
    },
    {
      label: 'Manage a connection',
      keywords: ['connection', 'edit', 'settings', 'manage'],
      isAvailable: ({ teamPermissions }) => !!teamPermissions && teamPermissions.includes('TEAM_EDIT'),
      Component: (props: CommandPaletteListItemDynamicProps) => {
        const setConnectionPickerMode = useSetRecoilState(connectionPickerModeAtom);
        return (
          <CommandPaletteListItem {...props} action={() => setConnectionPickerMode('manage')} icon={<DatabaseIcon />} />
        );
      },
    },
    {
      label: 'Add a connection',
      keywords: ['connection', 'new', 'create', 'add'],
      isAvailable: ({ teamPermissions }) => !!teamPermissions && teamPermissions.includes('TEAM_EDIT'),
      Component: (props: CommandPaletteListItemDynamicProps) => {
        const setShowAddConnectionMenu = useSetRecoilState(editorInteractionStateShowAddConnectionMenuAtom);
        return <CommandPaletteListItem {...props} action={() => setShowAddConnectionMenu(true)} icon={<AddIcon />} />;
      },
    },
  ],
};

export default commands;
