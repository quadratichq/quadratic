import { FormatAlignCenter, FormatAlignLeft, FormatAlignRight, FormatBold, FormatItalic } from '@mui/icons-material';
import { sheetController } from '../../../../grid/controller/SheetController';
import { KeyboardSymbols } from '../../../../helpers/keyboardSymbols';
import { setAlignment, setBold, setItalic } from '../../TopBar/SubMenus/formatCells';
import { CommandPaletteListItem } from '../CommandPaletteListItem';

const ListItems = [
  {
    label: 'Text: Bold',
    Component: (props: any) => {
      return (
        <CommandPaletteListItem
          {...props}
          icon={<FormatBold />}
          action={() => {
            setBold(!sheetController.sheet.getFormatPrimaryCell()?.bold);
          }}
          shortcut="B"
          shortcutModifiers={KeyboardSymbols.Command}
        />
      );
    },
  },
  {
    label: 'Text: Italic',
    Component: (props: any) => {
      return (
        <CommandPaletteListItem
          {...props}
          icon={<FormatItalic />}
          action={() => {
            setItalic(!sheetController.sheet.getFormatPrimaryCell()?.italic);
          }}
          shortcut="I"
          shortcutModifiers={KeyboardSymbols.Command}
        />
      );
    },
  },
  {
    label: 'Text: Align left',
    Component: (props: any) => {
      return <CommandPaletteListItem {...props} icon={<FormatAlignLeft />} action={() => setAlignment('left')} />;
    },
  },
  {
    label: 'Text: Align center',
    Component: (props: any) => {
      return <CommandPaletteListItem {...props} icon={<FormatAlignCenter />} action={() => setAlignment('center')} />;
    },
  },
  {
    label: 'Text: Align right',
    Component: (props: any) => {
      return <CommandPaletteListItem {...props} icon={<FormatAlignRight />} action={() => setAlignment('right')} />;
    },
  },
];

export default ListItems;
