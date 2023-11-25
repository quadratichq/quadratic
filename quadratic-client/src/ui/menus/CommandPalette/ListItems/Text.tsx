import {
  FontBoldIcon,
  FontItalicIcon,
  TextAlignCenterIcon,
  TextAlignLeftIcon,
  TextAlignRightIcon,
} from '@radix-ui/react-icons';
import { isEditorOrAbove } from '../../../../actions';
import { sheets } from '../../../../grid/controller/Sheets';
import { KeyboardSymbols } from '../../../../helpers/keyboardSymbols';
import { setAlignment, setBold, setItalic } from '../../TopBar/SubMenus/formatCells';
import { CommandPaletteListItem, CommandPaletteListItemSharedProps } from '../CommandPaletteListItem';

const ListItems = [
  {
    label: 'Text: Bold',
    isAvailable: isEditorOrAbove,
    Component: (props: CommandPaletteListItemSharedProps) => {
      return (
        <CommandPaletteListItem
          {...props}
          icon={<FontBoldIcon />}
          action={() => {
            setBold(!sheets.sheet.getFormatPrimaryCell()?.bold);
          }}
          shortcut="B"
          shortcutModifiers={[KeyboardSymbols.Command]}
        />
      );
    },
  },
  {
    label: 'Text: Italic',
    isAvailable: isEditorOrAbove,
    Component: (props: any) => {
      return (
        <CommandPaletteListItem
          {...props}
          icon={<FontItalicIcon />}
          action={() => {
            setItalic(!sheets.sheet.getFormatPrimaryCell()?.italic);
          }}
          shortcut="I"
          shortcutModifiers={KeyboardSymbols.Command}
        />
      );
    },
  },
  {
    label: 'Text: Align left',
    isAvailable: isEditorOrAbove,
    Component: (props: any) => {
      return <CommandPaletteListItem {...props} icon={<TextAlignLeftIcon />} action={() => setAlignment('left')} />;
    },
  },
  {
    label: 'Text: Align center',
    isAvailable: isEditorOrAbove,
    Component: (props: any) => {
      return <CommandPaletteListItem {...props} icon={<TextAlignCenterIcon />} action={() => setAlignment('center')} />;
    },
  },
  {
    label: 'Text: Align right',
    isAvailable: isEditorOrAbove,
    Component: (props: any) => {
      return <CommandPaletteListItem {...props} icon={<TextAlignRightIcon />} action={() => setAlignment('right')} />;
    },
  },
];

export default ListItems;
