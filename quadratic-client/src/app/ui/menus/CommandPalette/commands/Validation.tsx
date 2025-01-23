import { Action } from '@/app/actions/actions';
import type { CommandGroup } from '@/app/ui/menus/CommandPalette/CommandPaletteListItem';

export const validationCommandGroup: CommandGroup = {
  heading: 'Data validation',
  commands: [Action.InsertCheckbox, Action.InsertDropdown, Action.ToggleDataValidation],
};

export default validationCommandGroup;
