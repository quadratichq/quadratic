import { ExternalLinkIcon, FeedbackIcon } from '@/ui/icons';
import { useSetRecoilState } from 'recoil';
import { provideFeedbackAction, viewDocsAction } from '../../../../actions';
import { editorInteractionStateAtom } from '../../../../atoms/editorInteractionStateAtom';
import { CommandGroup, CommandPaletteListItem } from '../CommandPaletteListItem';

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
