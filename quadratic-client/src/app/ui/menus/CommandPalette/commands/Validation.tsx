import { validationAction } from '@/app/actions';
import { editorInteractionStateShowValidationAtom } from '@/app/atoms/editorInteractionStateAtom';
import { CommandGroup, CommandPaletteListItem } from '@/app/ui/menus/CommandPalette/CommandPaletteListItem';
import { useSetRecoilState } from 'recoil';

const validationCommandGroup: CommandGroup = {
  heading: 'Data validations',
  commands: [
    {
      label: validationAction.label,
      isAvailable: validationAction.isAvailable,
      Component: (props) => {
        const setShowValidation = useSetRecoilState(editorInteractionStateShowValidationAtom);
        return (
          <CommandPaletteListItem
            {...props}
            action={() => {
              setShowValidation(true);
            }}
          />
        );
      },
    },
  ],
};

export default validationCommandGroup;
