import { DocumentationIcon, FeedbackIcon, MailIcon } from '@/shared/components/Icons';
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
          icon={<DocumentationIcon />}
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
    {
      label: 'Contact us',
      Component: (props) => (
        <CommandPaletteListItem
          {...props}
          icon={<MailIcon />}
          action={() => {
            // TODO: (jimniels) implement
            // actionSpecContactUs.run();
          }}
        />
      ),
    },
  ],
};

export default commands;
