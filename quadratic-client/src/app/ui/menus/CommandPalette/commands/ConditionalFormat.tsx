import { Action } from '@/app/actions/actions';
import type { CommandGroup } from '@/app/ui/menus/CommandPalette/CommandPaletteListItem';

export const conditionalFormatCommandGroup: CommandGroup = {
  heading: 'Conditional formatting',
  commands: [Action.ToggleConditionalFormat, Action.AddConditionalFormat],
};

export default conditionalFormatCommandGroup;
