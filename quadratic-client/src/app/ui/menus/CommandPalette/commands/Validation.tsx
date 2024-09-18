import { Action } from '@/app/actions/actions';
import { CommandGroup } from '../CommandPaletteListItem';

export const validationCommandGroup: CommandGroup = {
  heading: 'Data validation',
  commands: [Action.InsertCheckbox, Action.InsertDropdown, Action.ToggleDataValidation],
};
