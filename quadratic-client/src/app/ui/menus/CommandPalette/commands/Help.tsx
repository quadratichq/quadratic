import { useSetRecoilState } from 'recoil';

import { provideFeedbackAction, viewDocsAction } from '@/app/actions';
import { editorInteractionStateAtom } from '@/app/atoms/editorInteractionStateAtom';
import { ExternalLinkIcon, FeedbackIcon } from '@/app/ui/icons';
import { CommandPaletteListItem } from '@/app/ui/menus/CommandPalette/CommandPaletteListItem';
import type { CommandGroup } from '@/app/ui/menus/CommandPalette/CommandPaletteListItem';

const commands: CommandGroup = {
  heading: 'Help',
  commands: [
    {
      label: viewDocsAction.label,
      Component: (props) => (
        <CommandPaletteListItem
          {...props}
          icon={<ExternalLinkIcon />}
          action={() => {
            viewDocsAction.run();
          }}
        />
      ),
    },
    {
      label: provideFeedbackAction.label,
      isAvailable: provideFeedbackAction.isAvailable,
      Component: (props) => {
        const setEditorInteractionState = useSetRecoilState(editorInteractionStateAtom);
        return (
          <CommandPaletteListItem
            {...props}
            icon={<FeedbackIcon />}
            action={() => {
              provideFeedbackAction.run({ setEditorInteractionState });
            }}
          />
        );
      },
    },
  ],
};

export default commands;
