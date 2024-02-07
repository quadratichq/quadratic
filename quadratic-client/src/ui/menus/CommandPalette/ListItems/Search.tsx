import { editorInteractionStateAtom } from '@/atoms/editorInteractionStateAtom';
import { Search } from '@mui/icons-material';
import { useSetRecoilState } from 'recoil';
import { KeyboardSymbols } from '../../../../helpers/keyboardSymbols';
import { CommandPaletteListItem, CommandPaletteListItemSharedProps } from '../CommandPaletteListItem';

const ListItems = [
  {
    label: 'Search: in current sheet',
    keywords: 'find',
    Component: (props: CommandPaletteListItemSharedProps) => {
      const setEditorInteractionState = useSetRecoilState(editorInteractionStateAtom);
      return (
        <CommandPaletteListItem
          {...props}
          icon={<Search />}
          action={() => setEditorInteractionState((state) => ({ ...state, showSearch: true }))}
          shortcut="F"
          shortcutModifiers={KeyboardSymbols.Command}
        />
      );
    },
  },
  {
    label: 'Search: in all sheets',
    keywords: 'find',
    Component: (props: CommandPaletteListItemSharedProps) => {
      const setEditorInteractionState = useSetRecoilState(editorInteractionStateAtom);
      return (
        <CommandPaletteListItem
          {...props}
          icon={<Search />}
          action={() => setEditorInteractionState((state) => ({ ...state, showSearch: { sheet_id: undefined } }))}
        />
      );
    },
  },
];

export default ListItems;
