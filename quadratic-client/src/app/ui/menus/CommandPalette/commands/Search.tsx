import { useSetRecoilState } from 'recoil';

import { findInSheet, findInSheets } from '@/app/actions';
import { editorInteractionStateAtom } from '@/app/atoms/editorInteractionStateAtom';
import { KeyboardSymbols } from '@/app/helpers/keyboardSymbols';
import { CommandPaletteListItem } from '@/app/ui/menus/CommandPalette/CommandPaletteListItem';
import type { CommandGroup } from '@/app/ui/menus/CommandPalette/CommandPaletteListItem';

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
