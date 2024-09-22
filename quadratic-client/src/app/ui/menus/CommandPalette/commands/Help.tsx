import { Action } from '@/app/actions/actions';
import { defaultActionSpec } from '@/app/actions/defaultActionsSpec';
import { CommandGroup, CommandPaletteListItem } from '../CommandPaletteListItem';

const docsAction = defaultActionSpec[Action.HelpDocs];
const feedbackAction = defaultActionSpec[Action.HelpFeedback];
const contactAction = defaultActionSpec[Action.HelpContactUs];

const commands: CommandGroup = {
  heading: 'Help',
  commands: [
    {
      label: docsAction.label,
      Component: (props) => (
        <CommandPaletteListItem
          {...props}
          icon={docsAction.Icon ? <docsAction.Icon /> : undefined}
          action={() => {
            docsAction.run();
          }}
        />
      ),
    },
    {
      label: feedbackAction.label,
      isAvailable: feedbackAction.isAvailable,
      Component: (props) => {
        return (
          <CommandPaletteListItem
            {...props}
            icon={feedbackAction.Icon ? <feedbackAction.Icon /> : undefined}
            action={() => {
              feedbackAction.run();
            }}
          />
        );
      },
    },
    {
      label: contactAction.label,
      Component: (props) => (
        <CommandPaletteListItem
          {...props}
          icon={contactAction.Icon ? <contactAction.Icon /> : undefined}
          action={() => {
            contactAction.run();
          }}
        />
      ),
    },
  ],
};

export default commands;
