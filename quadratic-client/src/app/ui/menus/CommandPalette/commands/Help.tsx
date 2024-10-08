import { Action } from '@/app/actions/actions';
import { CommandGroup } from '../CommandPaletteListItem';

const commands: CommandGroup = {
  heading: 'Help',
  commands: [
    Action.HelpFeedback,
    Action.HelpContactUs,
    Action.HelpDocs,
    Action.HelpQuadratic101,
    Action.HelpCommunity,
    Action.HelpChangelog,
  ],
};

export default commands;
