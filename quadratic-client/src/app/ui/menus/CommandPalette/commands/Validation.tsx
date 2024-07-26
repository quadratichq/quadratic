import { validationAction } from '../../../../actions';
import { editorInteractionStateAtom } from '../../../../atoms/editorInteractionStateAtom';
import { CommandGroup, CommandPaletteListItem } from '../CommandPaletteListItem';
import { useSetRecoilState } from 'recoil';

const commands: CommandGroup = {
  heading: 'Data Validation',
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

export default commands;
