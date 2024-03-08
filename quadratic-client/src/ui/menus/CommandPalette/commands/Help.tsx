import { ChatBubbleIcon, ExternalLinkIcon } from '@radix-ui/react-icons';
import { useSetRecoilState } from 'recoil';
import { provideFeedbackAction, viewDocsAction } from '../../../../actions';
import { editorInteractionStateAtom } from '../../../../atoms/editorInteractionStateAtom';
import { CommandGroup, CommandPaletteListItem, CommandPaletteListItemDynamicProps } from '../CommandPaletteListItem';

const commands: CommandGroup = {
  heading: 'Help',
  commands: [
    {
      label: viewDocsAction.label,
      Component: (props: CommandPaletteListItemDynamicProps) => (
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
      Component: (props: CommandPaletteListItemDynamicProps) => {
        const setEditorInteractionState = useSetRecoilState(editorInteractionStateAtom);
        return (
          <CommandPaletteListItem
            {...props}
            icon={<ChatBubbleIcon />}
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
