import { useSetRecoilState } from 'recoil';
import { validationAction } from '../../../../actions';
import { editorInteractionStateAtom } from '../../../../atoms/editorInteractionStateAtom';
import { CommandGroup, CommandPaletteListItem } from '../CommandPaletteListItem';

export const validationCommandGroup: CommandGroup = {
  heading: 'Data validations',
  commands: [
    {
      label: validationAction.label,
      isAvailable: validationAction.isAvailable,
      Component: (props) => {
        const setEditorInteractionState = useSetRecoilState(editorInteractionStateAtom);
        return (
          <CommandPaletteListItem
            {...props}
            action={() => {
              setEditorInteractionState((old) => ({ ...old, showValidation: true }));
            }}
          />
        );
      },
    },
  ],
};
