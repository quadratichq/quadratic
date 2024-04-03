import { findInSheet, findInSheets } from '@/actions';
import { editorInteractionStateAtom } from '@/atoms/editorInteractionStateAtom';
import { useSetRecoilState } from 'recoil';
import { KeyboardSymbols } from '../../../../helpers/keyboardSymbols';
import { CommandGroup, CommandPaletteListItem } from '../CommandPaletteListItem';

const commands: CommandGroup = {
  heading: 'Search',
  commands: [
    {
      label: findInSheet.label,
      keywords: ['search'],
      Component: (props) => {
        const setEditorInteractionState = useSetRecoilState(editorInteractionStateAtom);
        return (
          <CommandPaletteListItem
            {...props}
            action={() => setEditorInteractionState((state) => ({ ...state, showSearch: true }))}
            shortcut="F"
            shortcutModifiers={KeyboardSymbols.Command}
          />
        );
      },
    },
    {
      label: findInSheets.label,
      keywords: ['search'],
      Component: (props) => {
        const setEditorInteractionState = useSetRecoilState(editorInteractionStateAtom);
        return (
          <CommandPaletteListItem
            {...props}
            action={() => setEditorInteractionState((state) => ({ ...state, showSearch: { sheet_id: undefined } }))}
            shortcut="F"
            shortcutModifiers={[KeyboardSymbols.Shift, KeyboardSymbols.Command]}
          />
        );
      },
    },
  ],
};

export default commands;
