import { validationAction } from '../../../../actions';
import { editorInteractionStateAtom } from '../../../../atoms/editorInteractionStateAtom';
import { CommandGroup, CommandPaletteListItem } from '../CommandPaletteListItem';
import { useSetRecoilState } from 'recoil';

export const validationCommandGroup: CommandGroup = {
  heading: 'Data Validations',
  commands: [
    {
      label: validationAction.label,
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
